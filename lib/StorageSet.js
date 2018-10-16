const JobManager = require('./JobManager')
class StorageSet {
	constructor ({queueManager, redis, namespace}) {
		this.queueManager = queueManager
		this.redis = redis
		this.namespace = namespace
		// this.priority = priority || 'default'
		// console.assert(['high', 'default', 'low'].indexOf(priority) !== -1, 'priority must in [high, default, low]')
	}
	// jobManager or redisKey
	async add (item) {
		if (item instanceof JobManager) {
			let jobManager = item
			return await this.redis.zadd(this.namespace, jobManager.score, jobManager.redisKey)
		} else {
			let redisKey = item
			let obj = JSON.parse(redisKey)
			if (this === this.queueManager.retryStorageSet) {
				obj.currentTry++
				if (obj.currentTry <= obj.totalTry) {
					let Job = this.queueManager.jobs
					for (let key of obj['Job'].split('.')) {
						Job = Job[key]
					}
					let additionScore = obj.currentTry * obj.currentTry * obj.currentTry * 10
					if (Job.tryInterval) {
						let customAddition = Job.tryInterval(obj.currentTry)
						if (typeof customAddition === 'number' && !isNaN(customAddition)) {
							additionScore = customAddition
						}
					}
					return await this.redis.zadd(this.namespace, parseInt(Date.now() / 1000 + additionScore), redisKey)
				} else { // 将任务添加到失败队列
					return await this.redis.zadd(this.queueManager.failedStorageSet.namespace, parseInt(Date.now() / 1000), redisKey)
				}
			}
		}
	}
	
	async delete (redisKey) {
		return await this.redis.zrem(this.namespace, redisKey)
	}
}
module.exports = StorageSet