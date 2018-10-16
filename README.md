# CoilsQueueJob
[application._queueJob]

### Install
```
npm i snake-queue-job -S
```

### Usage
```
const redisClient = require('snake-redis').createClient()
const SnakeQueueJob = require('snake-queue-job')
const queueManager = new QueueManager({redis: redisClient})
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
