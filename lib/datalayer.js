/*

TODO: 有關於資料頁面化！
Data -> Page Script
這樣可以做成 hydration


三大資料源

1. operation
2. tap
3. state this.get() ui內部資料，也可以寄存在store之中 (ex. 計算樣式)
         ui外部資料分散到op/tap之中 (ex. 過濾某個分類, 分頁到第幾頁)


(X)future.relates = [[obj, key]...]
future?.isPending  是否等待中
future?.previous   之前的物件
future.optimistic
future.set(value)  無論結果而設定成特定值
future.bind(slot)
future?.error

future = Future.set(obj, key || Future.end, promise, {
    recover: true       失敗的時候還原previous
    deleteAtEnd: true   結束時刪除
    suspend: true       呼叫future.run()時才會真正執行
})

promise 通常是一個graphql fetch

## server data
   客戶端完全沒有機會更改這個data
## client(distributed) hold client data
   可以借存在server中，但server不會對其作出處置
   可以存放在url+history
   可以存放在localStorage/sessionStorage
## server(central) hold client data
   客戶端不會任意更改這個data，而是把變更請求送到伺服端，伺服端再回傳更動後的data

## 非同步狀態，「非同步行動」本身的狀態
## 不完整狀態，延伸資料 pagination/fragment
## 未提交狀態，堆疊在本地之中，可以上一步甚至取消。
   以overlay覆蓋 server hold client data



obj.__typename
obj.id
obj.etag
obj.expire

(X)obj.lastModify 是一個Date.now()
(X)obj.refetch 是一個 future，可以更新這個物件
(X)obj.fragment.XXXX.refetch 是一個 future，可以更新這個物件的部分資訊
(X)obj.discard()  留下空殼，垃圾回收本身資料


container | PaginationList
container[Symbol.iterator]      object array
container.previousPage
container.nextPage              is future null/Suspend/Pending


subscription                抽象化概念，透過websocket/web-push
subscription.register()
subscription.reconnect()
subscription.queue          接收資料的列隊


type x {
  client(tags: $tags)
}
tags = { ID: ETAG, ... }


## subscription/pub protocol 可以單獨使用，也可以與tap混用


## peer protocol 可以單獨使用，也可以與tap混用


## tap protocol 可以單獨使用，也可以與peer混用


tap.clientId
(X)tap.load
(X)tap.save

TODO: 根據repository.getter決定要不要push，概念有點像renderer

tap.publishes       auto push
tap.push(op to repository)    主動給出
tap.pull(op from repository)  主動收到

tap.serve?                    被動給出
tap.subscriptions             被動收到


tap.dispatch(action || [action...])

tap.object
tap.object.tap
tap.object.save()     maybe object is Store
tap.object.load()     maybe object is Store

DocumentService is a subscription
FileDocument | FileRoot is a tap 檔案系統

fileRoot.open



*/








// act-assign 分法，將act存放在data之中，下放。
// 上游(contorller)以act綁定事件處理

// function act(renderer, symbol, event, handler) {
//     // must not be arrow function
//     console.assert(renderer.prototype !== undefined);
//     renderer.prototype.events ||= {};
//     renderer.prototype.events[`${event} [data-symbol-${symbol}]`] = handler;
//     const acts = (renderer.prototype.acts ||= {});
//     acts[symbol] = ` [data-symbol-${symbol}]`;
// }

function act(key, handler) {
  let [event_type, ...selector] = key.split(' ');
  return [event_type, selector || '*', handler, {isAct: true}];
}



// class Serializable {

//   deref() {
//     return this.id;
//   }

//   static registers = {};
//   static register(cls, typename, creator) {
//     typename ||= cls.constructor.name;
//     registers[typename] = (creator || cls.create ||
//         d =>  Object.assign(Object.create(cls.prototype,
//             cls.properties ? cls.properties() : undefined), d));
//   }

//   serialize(obj) {
//     if (typeof obj !== 'object') return obj;
//     const proto = Object.getPrototypeOf(obj);
//     const typename = proto?.constructor?.name;
//     if (Array.isArray(obj)) {
//       return obj.map(Serializable.serialize);
//     } if (obj.reduce) {
//       obj = obj.reduce();
//     } else if (typename && Serializable.registers[typename]) {
//       obj = {__typename: typename, ...obj};
//     }
//     for (const key in obj) {
//       obj[key] = Serializable.serialize(obj[key]);
//     }
//     return obj;
//   }

//   deserialize(data) {
//     if (typeof data !== 'object') return data;
//     if (Array.isArray(data)) {
//       return data.map(Serializable.deserialize);
//     } else if (data.__typename) {
//       const typename = data.__typename;
//       if (!Serializable.registers[typename]) {
//         throw new Error(`unknown typename '${typename}'`);
//       }
//       const obj = {};
//       for (const key in data) {
//         if (key === '__typename') continue;
//         obj[key] = Serializable.deserialize(data[key]);
//       }
//       const creator = Serializable.registers[typename];
//       return creator(obj);
//     } else {
//       return {...data};
//     }
//   }
// }


const FutureProperties = {
  isPending: {
    get() { return !this.isResolved && !this.isResolved },
  },
  isResolved: {
    value: false,
    writable: true,
  },
  isRejected: {
    value: false,
    writable: true,
  },
  result: {
    value: undefined,
    writable: true,
  },
  error: {
    value: undefined,
    writable: true,
  },
}

function Future(promise) {
  // Don't create a wrapper for promises that can already be queried.
  if (promise.isPending !== undefined) {
    return promise;
  }
  Object.defineProperties(promise, FutureProperties);
  (async () => {
    try {
      promise.result = await promise;
      promise.isResolved = true;
      return promise.result;
    } catch(e) {
      promise.error = e;
      promise.isRejected = true;
      throw e;
    }
  })();
  return promise;
}


class Operation {

  static properties = () => ({
    previousData: {
      value: undefined,
      writable: true,
    }
    operationParameters: {
      value: undefined,
      writable: true,
    }
    future: {
      value: undefined,
      writable: true,
    },
    recoverAtError: {
      value: false,
      writable: true,
    },
    parentStore: {
      value: undefined,
      writable: true,
    }
  });

  get isSuspend() { return !this.future; }
  get isPending() { return !!this.future?.isPending; }
  get error() { return this.future?.error; }

  setParam(param) {
    this.operationParameters = param;
  }
  setData(future) {
    if (!future || future === this.future) {
      if (this.future.error && this.recoverAtError) {
        // pass
      } else {
        if (Object.keys(this).length !== 0) {
          this.previousData = {...this};
          this.clear();
        }
        if (typeof this.future.result === 'object') {
          let result;
          if (this.parentStore) {
            result = this.parentStore.receiveObject(this.future.result);
          } else {
            result = this.future.result;
          }
          Object.assign(this, result);
        }
      }
    }
  }

  clear() {
    for (const key in this) {
      delete this[key];
    }
  }

  copy() {
    const op = Operation.create();
    Object.assign(op, this);
    op.raise = this.raise;
    op.operationParameters = this.operationParameters;
    op.recoverAtError = this.recoverAtError;
    return op;
  }

  async refetch(param) {
    if (param) {
      this.setParam(param);
    }
    const future = Future(this.raise(this.operationParameters));
    this.future = future;
    this.future.finally(() => this.setData(future));
  }
}


class Store {
  // store 是一個巢狀而且serializable的物件
  // (X)store 是event listener
  // store 的內容儲存在localstorage或是indexDb
  // store 還儲存著id_token等等的登入資訊，除了用來識別不同的repo，也用來發起op
  static cache = {};

  // slotStates = {};

  constructor({origins, eventTarget} = {}) {
    // store.cache     儲存著所有的immutable? objects，功用類似cache
    Object.defineProperties(this, {
      cache: {
        value: Store.cache,
        // configurable: false,
        // enumerable: false,
        // writable: false,
      },
      eventTarget: {
        value: eventTarget || new EventTarget(),
      },
    });
    (origins || []).forEach(this.addOrigin);
  }

  static listen(event_type, handler) {
    return [event_type, (slot) => slot?.store?.eventTarget, handler];
  }

  addOrigin() {
    // origin中的設定會決定要push到哪，pull自哪
    // 要push的屬性，要pull的屬性
  }

  createObject(data) {
    const dataTypename = Object.getPrototypeOf(data).constructor?.name;
    if (dataTypename !== data.__typename) {
      obj = new self[data.__typename]();
      obj.__typename = data.__typename;
    } else {
      obj = data;
    }
    if (data.id) {
      this.cache[data.id] = obj;
    }
    return obj;
  }

  receiveObject(data) {
    if (typeof data === 'object') {
      for (const key in data) {
        data[key] = this.receiveObject(data[key]);
      }
    }
    if (data?.id && data?.__typename) {
      let obj = (this.cache[data.id] || this.createObject(data));
      if (obj.__typename ! == data.__typename) {
        throw new Error('same id but differect typename');
      }
      if (obj !== data) {
        Object.assign(obj, data);
      }
      return obj;
    } else if (data?.__typename) {
      return this.createObject(data);
    }
    return data;
  }

  sendObject(obj, cachedObject = true) { //new Set()) {
    if (cachedObject && obj?.id && obj?.__typename) {
      cachedObject?.add && cachedObject.add(obj.id);
      return { id: obj.id, __typename: obj.__typename };
    }
    if (Array.isArray(obj)) {
      return obj.map(o => this.sendObject(o, cachedObject));
    } else if (typeof obj === 'object') {
      let kv = Object.entries(obj);
      kv.forEach(item => {
        item[1] = this.sendObject(item[1], cachedObject);
      });
      let newobj = Object.fromEntries(kv);
      if (obj.__typename) {
        newobj.__typename = obj.__typename;
      }
      return obj;
    } else {
      return obj;
    }
  }

  createOperation(op_blueprint) {

  }

  save() {
    const cachedObject = new Set()
    const store = this.sendObject(this, cachedObject);
    let cache = cache.values().map(k => [k, this.sendObject(this.store[k], false)]);
    cache = Object.fromEntries(cache);
    let data = {
      store,
      cache,
    };
    data = JSON.stringify(data);

    let list = window.localStorage.getItem('store_list');
    if (!list.includes(`${this.id},`)) {
      list = `${list}${this.id},`;
      window.localStorage.setItem('store_list', list);
    }
    window.localStorage.setItem(this.id, data);
  }

  load(repo, version) {
    let data = window.localStorage.getItem(repo);
    if (data) {
      data = JSON.parse(data);
      this.receiveObject(data.cache || {});
      Object.assign(this, this.receiveObject(data.store));
    }
  }
}




async function run(operation, params) {
  const response = await fetch('http://localhost:8080/graphql', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      variables: {},
    })
  })
  const j = await response.json();
  operation.setData(j.data);
  operation.error = j.error?.length ? j.error : undefined;
}

async function run2() {
  let blob = new Blob([JSON.stringify([0,1,2])], {type : 'application/json'});
  let fileOfBlob = new File([blob], 'aFileName.json'); // application/octet-stream

  let query2 = {
    "query": "mutation ($file: File!) { readTextFile(file: $file) }",
    "variables": { "file": null }
  }

  let form = new FormData();
  form.append('operations', JSON.stringify(query2));
  form.append('map', JSON.stringify({"0": ["variables.file"]}));
  form.append('0', fileOfBlob);

  const response = await fetch('http://localhost:8080/graphql', {
    method: 'POST',
    body: form,
  })
  const j = await response.json();
  console.log(j);

}

