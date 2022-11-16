/**
 * Contains all cache.
 * @type {Map<string, object>}
 */
const caches = new Map()

/**
 * Cache configuration type.
 * @typedef CacheConfig
 * @property {string} name cache name
 * @property {number} ttl time to live, cache eviction time in ms
 * @property {() => Promise<Map<any, any>>} asyncLoadFunction cache loading async function, return Promise<Map<any, any>>
 * @property {NodeJS.EventEmitter=} logEmitter cache loading logger
 */

/**
 * Cache internal configuration type.
 * @typedef InternalCacheConfig
 * @type {CacheConfig & {checkTimeMs: number}}
 */

/**
 * Cache instance type.
 * @typedef MemoryCache
 * @property {Function} refresh Cache forced refresh by programmatically: refreshing cache data before the cache eviction.
 * @property {(key: any) => { value: any, isOutdated: boolean}} getUnsafe Return the value by the key. If data is outdated, then emit a cache:log:warn event. If you use this feature, you must take care to handle outdated data.
 * @property {(key: any) => any} get Return the value by the key, if data is outdated, then throws a ERR_CACHE_OUT_OF_DATE error.
 * @property {() => Map<any, any>} getMapCopy Return the cache map copy
 */

/**
 * Private shutdown method symbol of a cache instance.
 */
const shutdown = Symbol('shutdown')

/**
 * Validate the name of the cache.
 * @param {string=} name cache name
 */
function validateName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw TypeError('name is required, and must be a string!')
  }
}

/**
 * Creating a cache.
 * @param {CacheConfig} config
 */
async function create({ name, ttl = 30000, asyncLoadFunction, logEmitter }) {
  const cacheInstance = await init({ name, ttl, asyncLoadFunction, logEmitter })
  caches.set(name, cacheInstance)
}

/**
 * Get a cache.
 * @param {string} name
 * @returns {MemoryCache=} an initialized cache, or undefined if not yet created
 */
function get(name) {
  validateName(name)
  return caches.get(name)
}

/**
 * Destroy a cache.
 * @param {string} name
 */
function destroy(name) {
  validateName(name)
  const cache = caches.get(name)
  if (cache) {
    cache[shutdown]()
    caches.delete(name)
  }
}

/**
 * Destroy all cache.
 * I recommend that you call this function before the process ends.
 */
function destroyAll() {
  for (let name of caches.keys()) {
    caches.get(name)[shutdown]()
    caches.delete(name)
  }
}

/**
 * Cache initialization, data loaded by asyncLoadFunction.
 * @param {CacheConfig} config
 */
async function init({ name, ttl = 30000, asyncLoadFunction, logEmitter }) {
  /**
   * Cache configuration.
   * @type {InternalCacheConfig}
   */
  const config = {
    name: '',
    ttl: 0,
    checkTimeMs: 0,
    asyncLoadFunction: async () => {
      return new Map()
    },
    /** @type {NodeJS.EventEmitter | undefined} */ logEmitter: undefined
  }

  /** Cache map */
  let map = new Map()
  let isInitialized = !!caches.get(name)
  let isOutdated = false
  /** Counting cache refresh */
  let count = 0
  /** Last refresh time (epoch) */
  let lastLoadTimestamp
  /** Forced reload by user */
  let isForcedReload = false
  /**
   * Interval variable for cache eviction check
   * @type {NodeJS.Timer}
   */
  let checkCacheInterval

  /**
   * Cache data loader, load data by asyncLoadFunction.
   * Emit a 'cache:log:load' event.
   */
  async function load() {
    const isExpired = Date.now() - lastLoadTimestamp > config.ttl
    if (isForcedReload || !lastLoadTimestamp || isExpired) {
      count++
      // reset variable must be the first one
      lastLoadTimestamp = Date.now()
      // emit log event
      config.logEmitter?.emit(
        'cache:log:load',
        config.name,
        count,
        isForcedReload,
        lastLoadTimestamp,
        isExpired
      )
      isForcedReload = false
      // cache refreshing
      try {
        map = await config.asyncLoadFunction()
        isOutdated = false
      } catch (error) {
        isOutdated = true
        throw error
      }
    }
  }

  if (isInitialized) {
    throw Error(
      name +
        ' cache is already initialized! Use refresh() function to forcing reload.'
    )
  }
  validateName(name)
  if (
    !asyncLoadFunction ||
    asyncLoadFunction.constructor.name !== 'AsyncFunction'
  ) {
    throw Error(
      'asyncLoadFunction is required, and must returns a Promise<Map<any, any>>!'
    )
  }
  if (ttl < 1000) {
    throw Error('ttl must be >= 1000ms, default is 30000ms')
  }
  config.asyncLoadFunction = asyncLoadFunction
  config.name = name
  config.ttl = ttl
  config.checkTimeMs = ttl / 10
  config.logEmitter = logEmitter
  Object.freeze(config)
  let startTime = Date.now()
  config.logEmitter?.emit('cache:log:init:start', config.name)
  // init
  await load()
  let runtime = Date.now() - startTime
  config.logEmitter?.emit('cache:log:init:end', config.name, runtime)
  // checking cache eviction
  checkCacheInterval = setInterval(async () => await load(), config.checkTimeMs)

  return {
    /**
     * Shutdown interval: stop TTL watching.
     */
    [shutdown]() {
      isOutdated = true
      // cache's data becomes obsolete: stop refreshing
      clearInterval(checkCacheInterval)
    },

    async refresh() {
      config.logEmitter?.emit(
        'cache:log:refresh',
        config.name,
        count,
        lastLoadTimestamp
      )
      isForcedReload = true
      await load()
    },

    getUnsafe(key) {
      if (isOutdated) {
        config.logEmitter?.emit(
          'cache:log:warn',
          config.name,
          config.name + ' cache is outdated.'
        )
      }
      let value = map?.get(key)
      config.logEmitter?.emit('cache:log:getUnsafe', config.name, key, value)
      return {
        value,
        isOutdated
      }
    },

    get(key) {
      if (isOutdated) {
        const error = new Error('Cache is outdated.')
        error.code = 'ERR_CACHE_OUT_OF_DATE'
        throw error
      }
      let value = map?.get(key)
      config.logEmitter?.emit('cache:log:get', config.name, key, value)
      return value
    },

    getMapCopy() {
      return new Map(map)
    }
  }
}

export default { create, get, destroy, destroyAll }
