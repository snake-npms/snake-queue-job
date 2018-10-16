const path = require('path')
const StorageSet = require('./StorageSet')
const RunningManager = require('./RunningManager')
const JobManager = require('./JobManager')
class QueueManager {
	constructor ({redis, jobsPath = 'app/jobs', namespace = '_coils_jobs_'}) {
		this.redis = redis
		this.namespace = namespace
		this.statNamespace = `${namespace}:stat`
		this.jobs = require(path.resolve(process.cwd(), jobsPath))
		// 等待执行集合
		this.waitingStorageSet = new StorageSet({queueManager: this,redis, namespace: `${this.namespace}:storage_set:waiting`})
		// 准备就绪集合
		// this.readyStorageSet = new StorageSet({redis, namespace: `${this.namespace}:storage_set:ready`})
		// 现在改为用队列存储
		// 正在执行集合
		this.runningStorageSet = new StorageSet({queueManager: this,redis, namespace: `${this.namespace}:storage_set:running`})
		// 等待重试集合
		this.retryStorageSet = new StorageSet({queueManager: this,redis, namespace: `${this.namespace}:storage_set:retry`})
		// 执行失败集合
		this.failedStorageSet = new StorageSet({queueManager: this,redis, namespace: `${this.namespace}:storage_set:failed`})
		
		setTimeout(async () => {
			await this.initializeConfig()
			// 开始轮询
			this.runningManager = new RunningManager({queueManager: this, redis: redis, namespace: `${this.namespace}:running_manager`, waitingStorageSet: this.waitingStorageSet, runningStorageSet: this.runningStorageSet, retryStorageSet: this.retryStorageSet, failedStorageSet: this.failedStorageSet})
			this.runningManager.start()
		})

		// setInterval(() => {
		// 	console.log('concurrency', this.currentConcurrency, this.concurrency, '------')
		// }, 100)
	}
	async initializeConfig () {
		let config = await this.redis.hgetall(`${this.namespace}.config`) || {}
		this.status = config['status'] || 'quiet'
		this.currentConcurrency = 0 // 当前0个在执行
		this.concurrency = config['concurrency'] || 15 // 25个并发
		this.pollingInterval = config['polling_interval'] || 8 // 8s 轮询
		return config
	}
	/**
	 * Job: Job Class String
	 * */
	add (JobStr, config) {
		return new JobManager({queueManager: this, JobStr, config})
	}
	
	_pushToRedis (jobManager) {
		if (this.status === 'stopped') {
			console.error('====== job stopped, can not add job. ======')
		}
		// 进入等待队列
		this.waitingStorageSet.add(jobManager)
	}
	
	async setConfig (key, value) {
		await this.redis.hset(`${this.namespace}.config`, key, value)
	}
	// status: ['stop', 'quiet', 'running']
	async changeStatus (status) {
		console.assert(['stopped', 'quiet', 'running'].indexOf(status) !== -1, 'status must in [stopped, quiet, running]')
		this.setConfig('status', status)
	}
	async changeConcurrency (count) {
		this.setConfig('concurrency', count)
	}
	async changePollingInterval (second) {
		console.assert(second >= 2, 'minimum is 2 second')
		this.setConfig('polling_interval', second)
	}
}
module.exports = QueueManager