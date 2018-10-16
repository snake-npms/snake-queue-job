# CoilsQueueJob
[application._queueJob]

### Install
```
npm i snake-queue-job -S
```

### Usage
```bash
const redisClient = require('snake-redis').createClient()
const SnakeQueueJob = require('snake-queue-job')
const queueManager = new QueueManager({redis: redisClient})
# set status, default: quiet
await queueManager.changeStatus('quiet')
# default 15
await queueManager.changeConcurrency(19)
# minimum is 2 second, default 8
await queueManager.changePollingInterval(5)
```
options
- redis: redis client, default: `application._redis`
- path: default: `app/jobs` 
- namespace: default: `_coils_jobs_`

### 添加延时任务
```
# 10s 后执行 app/jobs目录下的HelloJob任务
queueManager.add('HelloJob').set({wait: 10}).perform_later('world-after1')
```

#### Jobs目录结构
![](https://github.com/coils-npm/snake-queue-job/blob/master/test/assets/struct.jpg?raw=true)
- In `app/jobs/index.js` write 
```
const requireDirectory = require('require-directory')
module.exports = requireDirectory(module)
```
confirm install npm dependence: `require-directory`

- `app/jobs/HelloJob.js`
```
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
```


### 提示

同一时刻相同参数的任务只会被追加一次
eg: 同一时刻(年月日时分秒)调用两次任务
```
queueManager.add('HelloJob').set({wait: 40}).perform_later('world-after')
queueManager.add('HelloJob').set({wait: 40}).perform_later('world-after')
```
内部会根据当前时间，wait, args, jobName， priority， totalTry,... 生成一个唯一key, 相同的key会被忽略