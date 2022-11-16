# oss-cache - Zero dependency Node.js memory cache with TTL

oss-cache can handle multiple caches.

**Install:** `npm i @patoi/oss-cache`

## Using

```javascript
import Caches from '@patoi/oss-cache'

// creating a cache
await Caches.create({
  name: 'cacheTest',
  ttl: 5555,
  asyncLoadFunction: async function () {
    let _map = new Map()
    _map.set('key', 'value')
    return _map
  },
  // optional
  logEmitter
})

// using cacheTest cache
const cacheTest = Caches.get('cacheTest')
const value = cacheTest.get('key')

// destroy a specific cache
Caches.destroy('cacheTest)
// destroy all cache, call before process exit
Cache.destroyAll()
```

- **name:** cache name
- **ttl (time-to-live):** cache eviction time in millisecond, when it expires, the cache will be refreshed
- **asyncLoadFunction:** cache data loader, async function, must return a JavaScript Map object
- **logEmmiter:** optional, listener of the cache log events

## Other features

**Programmatically triggered cache refresh**

```javascript
await cacheTest.refresh()
```

**Reading outdated cache: you may get old data, so it is not safe.**

```javascript
const cacheValue = cacheTest.getUnsafe(key)
// value of the key
console.log(cacheValue.value)
// isOutdated boolean, if true, then the data is outdated
console.log(cacheValue.isOutdated)
```

The cache may become stale if the asyncLoadFunction throws an error, or if the cache is being destroyed.

**If the cache reaches its TTL time and is refreshed again, the result of running asyncLoadFunction will be whether the cache is stale or not.**

## Best practices

1. Guard cache: check if the cache exists before using it.

```javascript
// using cacheTest cache
const cacheTest = Caches.get('cacheTest')
if (!cacheTest) throw new Error('Missing cache!')
const value = cacheTest.get('key')
```

2. Guard cache value: check the returned value.

```javascript
const value = cacheTest.get('unknown_key')
if (value === undefined) { // handling undefined value }
```

3. Guard outdated cache

```javascript
try {
  // outdated cache reading throws an error
  const value = cacheTest.get(key)
} catch (error) {
  // error.message: 'Cache is outdated.'
  // error.code: 'ERR_CACHE_OUT_OF_DATE'
}
```

You can use `getUnsafe(key)` method, it doesn't throw error if cache is outdated.

```javascript
  // outdated cache reading doesn't throw an error
  const cacheValue = cacheTest.getUnsafe(key)
  // if you want to handling fresh or outdated cases...
  if (cacheValue.isOutdated) {
    console.log('Outdated value:', cacheValue.value)
  } else {
    console.log('Fresh value:', cacheValue.value)
  }
}
```

4. Logging cache events, highly recommended: `'cache:log:warn'` event

```javascript
import { EventEmitter } from 'node:events'
import Caches from './lib/index.js'

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
      console.log('Cache explicit reload, refresh() called')
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
```