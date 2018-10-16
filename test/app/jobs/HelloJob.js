class HelloJob {
	// 执行优先级
	static get priority () {
		return 'default' //default, allow [low, default, high]
	}
	// 总尝试次数
	static get totalTry () {
		return 5 //default 10
	}
	// 根据当前尝试次数，返回下一次尝试间隔
	static tryInterval (currentTry) {
		// default: currentTry * currentTry * currentTry * 10
		// second
		return 50
	}
	// 任务执行时候将调用此方法
	async perform () {
		console.log(arguments)
	}
}
module.exports = HelloJob