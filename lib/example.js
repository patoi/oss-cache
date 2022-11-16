import { EventEmitter } from 'node:events'
// cache features
import Caches from './index.js'

// cache events logger
const logEmitter = new EventEmitter()

// cache warn event, for example: cache is outdated.
logEmitter.on('cache:log:warn', (name, message) =>
  console.log('Cache log warning', { name, message })
)

// cache data loading has started
logEmitter.on('cache:log:init:start', name =>
  console.log('Cache init started', { name })
)

// cache data loaded: runtime is the time of running of your cache initialization function (asyncLoadFunction)
logEmitter.on('cache:log:init:end', (name, runtime) =>
  console.log('Cache init end', { name, runtime })
)

// cache load event details
logEmitter.on(
  'cache:log:load',
  (name, count, isForcedReload, lastLoadTimestamp, isExpired) => {
    console.log('map refreshed: ', {
      name,
      count,
      isForcedReload,
      lastLoadTimestamp,
      isExpired
    })
    if (isExpired) {
      console.log('Cache expired, refresh')
    }
    if (isForcedReload) {
      console.log('Cache explicit reload')
    }
  }
)

// programmatically forced cache refresh event
logEmitter.on('cache:log:refresh', (name, count, lastLoadTimestamp) =>
  console.log('Cache refresh', { name, count, lastLoadTimestamp })
)

// cache read by get()
logEmitter.on('cache:log:get', (name, key, value) =>
  console.log('get()', { name, key, value })
)

// cache read by getUnsafe()
logEmitter.on('cache:log:getUnsafe', (name, key, value) =>
  console.log('getUnsafe()', { name, key, value })
)

// Creating a cache.
await Caches.create({
  name: 'cacheTest',
  ttl: 5555,
  asyncLoadFunction: async function () {
    // cache data loading take a time
    await new Promise(r => setTimeout(r, 1800))
    let _map = new Map()
    _map.set('key', Date.now())
    return _map
  },
  logEmitter
})

// Creating an other cache.
await Caches.create({
  name: 'cacheOtherTest',
  ttl: 2200,
  asyncLoadFunction: async function () {
    // cache data loading take a time
    await new Promise(r => setTimeout(r, 200))
    let _map = new Map()
    _map.set('otherKey1', 1)
    _map.set('otherKey2', 2)
    return _map
  },
  logEmitter
})

/**
 * Demo.
 */

const cacheTest = Caches.get('cacheTest')
if (!cacheTest) throw new Error('Missing cache!')

async function run() {
  if (!cacheTest) throw new Error('Missing cache!')
  // getUnsafe returns { value: any, isOutdated: boolean }, you need to handle (or not) the outdated value scenario (isOutdated === true)
  cacheTest.getUnsafe('key')
  // if the read data is outdated, then throws an Error (code = ERR_CACHE_OUT_OF_DATE)
  // you can catch it, and handle it
  cacheTest.get('key')
  await new Promise(r => setTimeout(r, 250))
}

// you can call programmatically a refresh on cache: good decision to use (writing a retry logic), when cache is isOutdated === true, or threw a ERR_CACHE_OUT_OF_DATE
setTimeout(async () => await cacheTest.refresh(), 3300)

setInterval(run, 100)

setTimeout(() => {
  console.log('Destroy cacheOtherTest')
  Caches.destroy('cacheOtherTest')
}, 3300)

setTimeout(() => {
  console.log('Destroy all cache')
  Caches.destroyAll()
}, 4300)
