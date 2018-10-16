class RunningQueue {
	constructor ({queueManager, redis, namespace, waitingStorageSet, runningStorageSet, retryStorageSet, failedStorageSet}) {
		this.queueManager = queueManager
		this.redis = redis
		this.readyStackNamespace = `${namespace}:ready_stack`
		this.waitingStorageSet = waitingStorageSet
		this.runningStorageSet = runningStorageSet
		this.retryStorageSet = retryStorageSet
		this.failedStorageSet = failedStorageSet
	}

	start () {
		this._runPolling()
		this._performJobs()
	}
	
	_runPolling () {
		setTimeout(async () => {
			// 轮询延迟任务
			await this._runPollingStorageSet(this.waitingStorageSet)
			await this._runPollingStorageSet(this.retryStorageSet)
			// 下一次轮询
			this._runPolling()
		}, parseInt(this.queueManager.pollingInterval * 1000 * 2 * Math.random()))
	}

	// 检查获取队列可执行任务来执行
	async _performJobs (timeout = 0) {
		setTimeout(async () => {
			if (this.queueManager.currentConcurrency < this.queueManager.concurrency) {
				let redisKey = await this.redis.rpop(this.readyStackNamespace)
				if (redisKey) {
					await this.runningStorageSet.add(redisKey)
					this.queueManager.currentConcurrency++
					setTimeout(async () => {
						try {
							let obj = JSON.parse(redisKey)
							let Job = this.queueManager.jobs
							for (let key of obj['Job'].split('.')) {
								Job = Job[key]
							}
							await (new Job()).perform(...obj.args)
							this.redis.incr(`${this.queueManager.statNamespace}:finished`)
						} catch (err) {
							this.retryStorageSet.add(redisKey)
							this.redis.incr(`${this.queueManager.statNamespace}:failed`)
							console.error(err)
						} finally {
							this.queueManager.currentConcurrency--
							await this.runningStorageSet.delete(redisKey)
						}
					})
					if (this.queueManager.currentConcurrency < this.queueManager.concurrency && redisKey) {
						timeout = 1
					}
				}
			}
			// 下一轮
			this._performJobs(timeout)
		}, timeout)
		timeout = this.queueManager.pollingInterval * 1000 * Math.random()
	}
	
	async _runPollingStorageSet (storageSet) {
		let key = `${storageSet.namespace}:had_polling`
		if (await this.redis.setnx(key, true)) {
			// 轮询一个周期的时间过期，才可以再次轮询, 防止资源浪费
			await this.redis.expire(key, this.queueManager.pollingInterval)
			try {
				// 可执行任务 全部放到 可执行集合(ReadyStorageSet)
				await this._pollingStorageSetToReadyStack(storageSet)
			} catch (err) { console.error(err) }
		}
	}
	
	async _pollingStorageSetToReadyStack (storageSet) {
		let redisKeys = await this.redis.zrangebyscore(storageSet.namespace, 0, parseInt(Date.now() / 1000))
		let redisKeyObjs = redisKeys.map(item => JSON.parse(item))
		redisKeyObjs.sort((a, b) => { return a.priority - b.priority })
		for (let obj of redisKeyObjs) {
			let redisKey = JSON.stringify(obj)
			if (obj.priority === 'high') {
				await this.redis.rpush(this.readyStackNamespace, redisKey)
			} else {
				await this.redis.lpush(this.readyStackNamespace, redisKey)
			}
			await this.redis.zrem(storageSet.namespace, redisKey)
		}
	}
}
module.exports = RunningQueue