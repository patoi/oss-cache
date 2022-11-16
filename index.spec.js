import assert from 'node:assert/strict'
import EventEmitter from 'events'
import sinon from 'sinon'
import Caches from './index.js'
import { fail } from 'node:assert'

describe('Caches', function () {
  let logs = []

  // cache events logger
  const logEmitter = new EventEmitter()

  // cache warn event, for example: cache is outdated.
  logEmitter.on('cache:log:warn', (name, message) => {
    logs.push({ event: 'cache:log:warn', name, message })
  })

  // cache data loading has started
  logEmitter.on('cache:log:init:start', name => {
    logs.push({ event: 'cache:log:init:start', name })
  })

  // cache data loaded: runtime is the time of running of your cache initialization function (asyncLoadFunction)
  logEmitter.on('cache:log:init:end', (name, runtime) => {
    logs.push({ event: 'cache:log:init:end', name, runtime })
  })

  // cache load event details
  logEmitter.on(
    'cache:log:load',
    (name, count, isForcedReload, lastLoadTimestamp, isExpired) => {
      logs.push({
        event: 'cache:log:load',
        name,
        count,
        isForcedReload,
        lastLoadTimestamp,
        isExpired
      })
    }
  )

  // programmatically forced cache refresh event
  logEmitter.on('cache:log:refresh', (name, count, lastLoadTimestamp) => {
    logs.push({ event: 'cache:log:refresh', name, count, lastLoadTimestamp })
  })

  // cache read by get()
  logEmitter.on('cache:log:get', (name, key, value) => {
    logs.push({ event: 'cache:log:get', name, key, value })
  })

  // cache read by getUnsafe()
  logEmitter.on('cache:log:getUnsafe', (name, key, value) => {
    logs.push({ event: 'cache:log:getUnsafe', name, key, value })
  })

  it('lifecycle is ok: create a cache, get the cache, read a value from cache, refresh and destroy the cache', async function () {
    await Caches.create({
      name: 'cacheTest',
      ttl: 5555,
      asyncLoadFunction: async function () {
        await new Promise(r => setTimeout(r, 100))
        let _map = new Map()
        _map.set('key1', 1)
        _map.set('key2', 2)
        return _map
      },
      logEmitter
    })
    const cacheTest = Caches.get('cacheTest')
    if (!cacheTest) throw Error('Missing cache!')
    cacheTest.get('key1')
    await cacheTest.refresh()
    cacheTest.get('key2')
    Caches.destroy('cacheTest')
    // assert log events
    // cacheTest init started
    assert.deepStrictEqual(logs[0], {
      event: 'cache:log:init:start',
      name: 'cacheTest'
    })
    // cacheTest load with data
    sinon.assert.match(logs[1], {
      event: 'cache:log:load',
      name: 'cacheTest',
      count: 1,
      isForcedReload: false,
      isExpired: false
    })
    sinon.assert.match(logs[1].lastLoadTimestamp, sinon.match.number)
    assert.deepStrictEqual(logs[2].event, 'cache:log:init:end')
    assert.deepStrictEqual(logs[2].name, 'cacheTest')
    sinon.assert.match(logs[2].runtime, sinon.match.number)
    assert.deepStrictEqual(logs[3], {
      event: 'cache:log:get',
      name: 'cacheTest',
      key: 'key1',
      value: 1
    })
    sinon.assert.match(logs[4], {
      event: 'cache:log:refresh',
      name: 'cacheTest',
      count: 1
    })
    sinon.assert.match(logs[1].lastLoadTimestamp, sinon.match.number)
    sinon.assert.match(logs[5], {
      event: 'cache:log:load',
      name: 'cacheTest',
      count: 2,
      isForcedReload: true,
      isExpired: false
    })
    sinon.assert.match(logs[5].lastLoadTimestamp, sinon.match.number)
    assert.deepStrictEqual(logs[6], {
      event: 'cache:log:get',
      name: 'cacheTest',
      key: 'key2',
      value: 2
    })
  })

  describe('create()', function () {
    it('error, because name is missing', async function () {
      try {
        await Caches.create({
          // @ts-ignore name is required
          name: undefined,
          ttl: 5555,
          asyncLoadFunction: async function () {
            let _map = new Map()
            _map.set('key1', 1)
            _map.set('key2', 2)
            return _map
          },
          logEmitter
        })
        assert.fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(
          error.message,
          'name is required, and must be a string!'
        )
      }
    })

    it('error, because TTL is smaller than 1000ms', async function () {
      try {
        await Caches.create({
          name: 'cacheTest',
          ttl: 800,
          asyncLoadFunction: async function () {
            let _map = new Map()
            _map.set('key1', 1)
            _map.set('key2', 2)
            return _map
          },
          logEmitter
        })
        assert.fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof Error)
        assert.strictEqual(
          error.message,
          'ttl must be >= 1000ms, default is 30000ms'
        )
      }
    })

    it('error, because asyncLoadFunction is missing', async function () {
      try {
        // @ts-ignore incomplete function call
        await Caches.create({
          name: 'cacheTest',
          ttl: 5555,
          logEmitter
        })
        assert.fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof Error)
        assert.strictEqual(
          error.message,
          'asyncLoadFunction is required, and must returns a Promise<Map<any, any>>!'
        )
      }
    })

    it('ok, because log emitter is optional', async function () {
      try {
        await Caches.create({
          name: 'cacheTest',
          ttl: 5555,
          asyncLoadFunction: async function () {
            let _map = new Map()
            _map.set('key1', 1)
            _map.set('key2', 2)
            return _map
          }
        })
        // delete creted cache
        Caches.destroy('cacheTest')
      } catch (error) {
        assert.fail('Should not throw error')
      }
    })
  })

  describe('get()', function () {
    it('error, because name is missing', async function () {
      try {
        // @ts-ignore argumentum is required
        Caches.get()
        fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(
          error.message,
          'name is required, and must be a string!'
        )
      }
    })

    it('error, because name is empty string', async function () {
      try {
        // @ts-ignore argumentum is required
        Caches.get('   ')
        fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(
          error.message,
          'name is required, and must be a string!'
        )
      }
    })

    it('error, because name is not a string', async function () {
      try {
        // @ts-ignore argumentum is required
        Caches.get(42)
        fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(
          error.message,
          'name is required, and must be a string!'
        )
      }
    })

    it('cache is undefined, because is not yet created', async function () {
      const cache = Caches.get('unknown_cache')
      assert.strictEqual(cache, undefined)
    })

    it('ok, return the cache', async function () {
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      // @ts-ignore argumentum is required
      const cache = Caches.get('cacheTest')
      assert.ok(cache)
      assert.ok(cache.refresh)
      assert.ok(cache.getUnsafe)
      assert.ok(cache.get)
      // @ts-ignore private method, not accessible
      assert.ok(!cache.shutdown)
      // delete the cache
      Caches.destroy('cacheTest')
    })
  })

  describe('destroy()', function () {
    it('error, because name is missing', async function () {
      try {
        // @ts-ignore argumentum is required
        Caches.destroy()
        fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(
          error.message,
          'name is required, and must be a string!'
        )
      }
    })

    it('error, because name is empty string', async function () {
      try {
        // @ts-ignore argumentum is required
        Caches.destroy('   ')
        fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(
          error.message,
          'name is required, and must be a string!'
        )
      }
    })

    it('error, because name is not a string', async function () {
      try {
        // @ts-ignore argumentum is required
        Caches.destroy(42)
        fail('Should throw error')
      } catch (error) {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(
          error.message,
          'name is required, and must be a string!'
        )
      }
    })

    it('ok, cache is undefined, because it is not yet created', async function () {
      try {
        Caches.destroy('unknown_cache')
        assert.ok(true)
      } catch (error) {
        assert.fail('Should not throw error')
      }
    })

    it('ok, cache does not exist after destroyed', async function () {
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      Caches.destroy('cacheTest')
      // reading destroyed cache
      const cache = Caches.get('cacheTest')
      // cache does not exist
      assert.equal(cache, undefined)
    })
  })

  describe('destroyAll()', function () {
    it('ok, no cache has been created yet', async function () {
      try {
        Caches.destroyAll()
        assert.ok(true)
      } catch (error) {
        assert.fail('Should not throw error')
      }
    })

    it('ok, all cache has been destroyed', async function () {
      await Caches.create({
        name: 'cacheTest1',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      await Caches.create({
        name: 'cacheTest2',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest1 = Caches.get('cacheTest1')
      const cacheTest2 = Caches.get('cacheTest2')
      // caches created
      assert.ok(!!cacheTest1)
      assert.ok(!!cacheTest2)
      Caches.destroyAll()
      // reading destroyed cache
      assert.equal(Caches.get('cacheTest1'), undefined)
      assert.equal(Caches.get('cacheTest2'), undefined)
    })

    it('ok, new cache could be created, after destroy all', async function () {
      await Caches.create({
        name: 'cacheTest1',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      await Caches.create({
        name: 'cacheTest2',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest1 = Caches.get('cacheTest1')
      const cacheTest2 = Caches.get('cacheTest2')
      // caches created
      assert.ok(!!cacheTest1)
      assert.ok(!!cacheTest2)
      Caches.destroyAll()
      // reading destroyed cache
      assert.equal(Caches.get('cacheTest1'), undefined)
      assert.equal(Caches.get('cacheTest2'), undefined)
      // creating a new cache
      await Caches.create({
        name: 'cacheNew',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheNew = Caches.get('cacheNew')
      assert.ok(!!cacheNew)
      assert.equal(cacheNew.get('key1'), 1)
    })
  })

  describe('cache.refresh()', function () {
    it('ok, reload cache data', async function () {
      // mock data generator
      let i = 0
      function* readData() {
        while (i < 5) {
          i++
          yield { key: `key${i}`, value: i }
        }
      }
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          const reading = readData()
          let data = reading.next().value
          _map.set(data.key, data.value)
          data = reading.next().value
          _map.set(data.key, data.value)
          return _map
        },
        logEmitter
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // reading cache: initial loaded data
      assert.equal(cacheTest.get('key1'), 1)
      assert.equal(cacheTest.get('key2'), 2)
      // refresh
      await cacheTest.refresh()
      // reading cache after reloaded new data
      assert.equal(cacheTest.get('key3'), 3)
      assert.equal(cacheTest.get('key4'), 4)
      // clean up
      Caches.destroyAll()
    })

    it('error, throws an error, because asyncLoadFunction has an error', async function () {
      // mock data generator
      let i = 0
      function* readData() {
        while (i < 5) {
          i++
          yield { key: `key${i}`, value: i }
        }
      }
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          const reading = readData()
          let data = reading.next().value
          _map.set(data.key, data.value)
          data = reading.next().value
          _map.set(data.key, data.value)
          if (data.value === 4) {
            throw new Error('Data resource error!')
          }
          return _map
        },
        logEmitter
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // reading cache: initial loaded data
      assert.equal(cacheTest.get('key1'), 1)
      assert.equal(cacheTest.get('key2'), 2)
      // handling programmatically called cache.refresh() error
      try {
        // refresh
        await cacheTest.refresh()
        assert.fail('Should throw an error')
      } catch (error) {
        assert.strictEqual(error.message, 'Data resource error!')
      } finally {
        // clean up
        Caches.destroyAll()
      }
    })
  })

  describe('cache.get()', function () {
    it('ok, get returns with value', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      assert.equal(cacheTest.get('key1'), 1)
      // clean up
      Caches.destroyAll()
    })

    it('ok, get returns with undefined, because no value for the key', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      assert.equal(cacheTest.get('key_unknown'), undefined)
      // clean up
      Caches.destroyAll()
    })

    it('ok, get called with undefiend, so it is returned with undefined', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // @ts-ignore get key argument is required
      assert.equal(cacheTest.get(), undefined)
      // clean up
      Caches.destroyAll()
    })

    it('ok, get called with null, so it is returned with undefined', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      assert.equal(cacheTest.get(null), undefined)
      // clean up
      Caches.destroyAll()
    })

    it('error, get called after cache destroyed', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // clean up
      Caches.destroyAll()
      // calling get() after cache has destroyed
      try {
        cacheTest.get('key1')
        assert.fail('Should throw an error')
      } catch (error) {
        assert.strictEqual(error.message, 'Cache is outdated.')
        assert.strictEqual(error.code, 'ERR_CACHE_OUT_OF_DATE')
      }
    })
  })

  describe('cache.getUnsafe()', function () {
    it('ok, getUnsafe returns with value', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      assert.equal(cacheTest.getUnsafe('key1').value, 1)
      // clean up
      Caches.destroyAll()
    })

    it('ok, getUnsafe returns with undefined, because no value for the key', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      assert.equal(cacheTest.getUnsafe('key_unknown').value, undefined)
      // clean up
      Caches.destroyAll()
    })

    it('ok, getUnsafe called with undefined, so it is returned with undefined', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // reading cache: initial loaded data
      // @ts-ignore get key argument is required
      assert.equal(cacheTest.getUnsafe().value, undefined)
      // clean up
      Caches.destroyAll()
    })

    it('ok, getUnsafe called with null, so it is returned with undefined', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // reading cache: initial loaded data
      assert.equal(cacheTest.getUnsafe(null).value, undefined)
      // clean up
      Caches.destroyAll()
    })

    it('ok, getUnsafe calling does not throw error, after cache is obsolated, you need to check isObsolate', async function () {
      // init cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 5555,
        asyncLoadFunction: async function () {
          let _map = new Map()
          _map.set('key1', 1)
          _map.set('key2', 2)
          return _map
        }
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // clean up
      Caches.destroyAll()
      // calling getUnsafe() after cache has destroyed
      const returned = cacheTest.getUnsafe('key1')
      // cache is obsolated, isOutdated must be true
      assert.strictEqual(returned.isOutdated, true)
      assert.strictEqual(returned.value, 1)
    })
  })

  describe('TTL, cache eviction', function () {
    it(' successful, cache refreshed', async function () {
      // is is a long running test
      this.slow(3000)
      // mock data generator
      let i = 0
      function* readData() {
        while (i < 7) {
          i++
          yield { key: `key${i}`, value: i }
        }
      }
      // create cache
      await Caches.create({
        name: 'cacheTest',
        ttl: 1000,
        asyncLoadFunction: async function () {
          let _map = new Map()
          const reading = readData()
          let data = reading.next().value
          _map.set(data.key, data.value)
          data = reading.next().value
          _map.set(data.key, data.value)
          return _map
        },
        logEmitter
      })
      const cacheTest = Caches.get('cacheTest')
      if (!cacheTest) throw Error('Missing cache!')
      // reading cache: initial loaded data
      assert.equal(cacheTest.get('key1'), 1)
      assert.equal(cacheTest.get('key2'), 2)
      // Waiting for TTl, cache eviction: loading new cache data
      await new Promise(r => setTimeout(r, 1200))
      // reading cache after reloaded new data
      assert.equal(cacheTest.get('key3'), 3)
      assert.equal(cacheTest.get('key4'), 4)
      // clean up
      Caches.destroyAll()
    })
  })
})
