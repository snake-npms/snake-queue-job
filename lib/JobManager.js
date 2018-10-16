class JobManager {
	constructor ({queueManager, JobStr, config}) {
		this.queueManager = queueManager
		this.createdAt = Date.now()
		/* config
		* time(s)
		* priority: low, default, high
		* */
		let Job = this.queueManager.jobs[JobStr]
		this.config = Object.assign({wait: 0}, config, {JobStr, priority: Job.priority || 'default', currentTry: 0, totalTry: Job.totalTry || 10})
	}
	
	get msScore () {
		return this.createdAt + this.config.wait * 1000
	}
	
	get score () {
		return parseInt(this.msScore / 1000)
	}
	
	get redisKey () {
		let {JobStr, priority, args, wait, currentTry, totalTry} = this.config
		return JSON.stringify({Job: JobStr, priority, args, msScore: this.msScore, wait, currentTry, totalTry})
	}
	
	set ({wait}) {
		this.config.wait = wait || 0
		return this
	}
	
	perform_later () {
	 	this.config.args = [...arguments]
		this.queueManager._pushToRedis(this)
	}
	perform_now () {
		this.config.args = [...arguments]
		return (new this.queueManager.jobs[this.config.JobStr]).perform(...this.config.args)
	}
}
module.exports = JobManager