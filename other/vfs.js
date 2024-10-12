
// 參考 https://github.com/jakearchibald/idb-keyval

function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        request.oncomplete = request.onsuccess = () => resolve(request.result);
        request.onabort = request.onerror = () => reject(request.error);
    });
}

// txMode: IDBTransactionMode,
// callback: (store: IDBObjectStore) => T | PromiseLike<T>,
function createStore(dbName, storeName) {
    const request = window.indexedDB.open(dbName, 2);
    request.onupgradeneeded = () => {
        request.result.deleteObjectStore(storeName);
        request.result.createObjectStore(storeName);
    }
    const dbp = promisifyRequest(request);

    return (txMode, callback) =>
        dbp.then((db) =>
            callback(db.transaction(storeName, txMode).objectStore(storeName)),
        );
}

defaultGetStoreFunc = null
function defaultGetStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore('keyval-store', 'keyval');
    }
    return defaultGetStoreFunc;
}


function dbget(key, customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        return promisifyRequest(store.get(key))
    });
}

function dbset(key, value, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.put(value, key);
        return promisifyRequest(store.transaction);
    });
}

function dbdel(key, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.delete(key);
        return promisifyRequest(store.transaction);
    });
}


function dbkeys(customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        return promisifyRequest(
            store.getAllKeys()
        );
    });
}











function b64_to_utf8(str) {
  return decodeURIComponent(escape(window.atob(str)));
}

class FlatTreeBase {
    constructor() {
        this.files = {};
        this.store = {};
    }

    static async gitDigestMessage(message) {
        let msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
        header = `blob ${msgUint8.byteLength}\0`
        msgUint8 = new TextEncoder().encode(header + message); // encode as (utf-8) Uint8Array

        const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8); // hash the message
        const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
        const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""); // convert bytes to hex string
        return hashHex;
    }

    static dbget = dbget;
    static dbset = dbset;
    static dbdel = dbdel;
    static dbkeys = dbkeys;


    async getFile(file_sha) {
        let text = this.store[file_sha];
        if (text === undefined) {
            text = await dbget(file_sha);
            if (text === undefined) {
                throw new Error(`text file '${file_sha}' not in database`);
            }
            this.store[file_sha] = text;
        }
        return text;
    }

    getSHA(path) {
        return this.files[path];
    }

    async read(path) {
        let sha = this.files[path];
        return sha === undefined ? undefined : await this.getFile(sha);
        // let data;
        // if (!(data = this.files[path])) {
        //     throw new Error(`file '${path}' not found at ${this.owner}/${this.repo}`);
        // }
        // const { origin, write } = data;
        // return await this.getFile(write);
    }

    async write(path, text) {
        // const data = this.files[path];
        const file_sha = await FlatTreeBase.gitDigestMessage(text);
        if (this.store[file_sha] === undefined) {
            this.store[file_sha] = text;
            // const keys = await dbkeys();
            // if (!keys.includes(file_sha)) {
            //     await dbset(file_sha, text);
            // }
        }
        let p = path;
        while (p = p.split('/').slice(0, -1).join('/')) {
            if (this.files[p] !== undefined) {
                throw new Error(`${this.files[p]} must be a directory, but is a file`);
            }
        }
        return (this.files[path] = file_sha);

        // if (data) {
        //     data.write = file_sha;
        // } else {
        //     // new file
        //     let p = path;
        //     while (p = p.split('/').slice(0, -1).join('/')) {
        //         if (this.files[p]) {
        //             throw new Error(`${this.files[p]} must be a directory, but is a file`);
        //         }
        //     }
        //     this.files[path] = { origin: null, write: file_sha };
        // }
    }

    delete(path) {
        if (this.files[path] === undefined) {
            throw new Error(`'${src}' not exists`);
        }
        delete this.files[path];
    }

    relink(src, dst) {
        if (this.files[src] === undefined) {
            throw new Error(`'${src}' not exists`);
        }
        if (this.files[dst] !== undefined) {
            throw new Error(`'${dst}' exists`);
        }
        const file_sha = this.files[src];
        this.delete(src);
        this.files[path] = file_sha;
    }

    fold() {
        const folders = new Map(); // string -> [string...]
        const add = (path) => {
            const comps = path.split('/');
            const dirname = comps.length > 1 ? comps.slice(0, -1).join('/') : '';
            const basename = comps[comps.length - 1];
            if (!folders.has(dirname)) {
                folders.set(dirname, []);
            }
            if (!folders.get(dirname).includes(basename)) {
                folders.get(dirname).push(basename);
            }
            if (dirname) {
                add(dirname);
            }
        }
        for (const path of Object.keys(this.files)) {
            add(path);
        }
        return folders;
    }

    listdir(path) {
        if (this.files[path] !== undefined) {
            throw new Error(`'${dst}' is not directory`);
        }
        const folders = this.fold();
        const names = folders.get(path);
        if (!names) {
            throw new Error(`'${dst}' not exists`);
        }
        return names;
    }

    async commit() {
        const folders = this.fold();
    }
}


class LocalStorageFlatTree extends FlatTreeBase {
    constructor(key) {
        super();
        this.key = key;
    }

    static async fetch(key) {
        const flattree = new LocalStorageFlatTree(key);
        const str = window.localStorage.getItem(key);
        let entries = [];
        if (str !== undefined) {
            entries = JSON.parse(str);
        }
        for (const [path, file_sha] of Object.values(entries)) {
            flattree.store[file_sha] = await dbget(file_sha);
            console.assert(flattree.store[file_sha] !== undefined);
            flattree.files[path] = file_sha;
        }
        return flattree;
    }

    async commit() {
        const keys = await dbkeys();
        const entries = [];
        for (const [path, file_sha] of Object.entries(this.files)) {
            console.assert(file_sha !== undefined);
            console.assert(this.store[file_sha] !== undefined);
            const text = this.store[file_sha];
            if (!keys.includes(file_sha)) {
                await dbset(file_sha, text);
                keys.append(file_sha);
            }
            entries.push([path, write]);
        }
        const str = JSON.stringify(entries);
        window.localStorage.setItem(this.key, str);
    }
}


class GithubFlatTree extends FlatTreeBase {
    constructor(octokit, owner, repo, ref, commit_sha, subpath) {
        super();
        this.origin_files = {};

        this.octokit = octokit;
        this.owner = owner;
        this.repo = repo;
        this.ref = ref;
        this.commit_sha = commit_sha;
        this.recursive_trees = [];
        this.subpath = subpath || '';
    }

    async _flat(tree, prefix) {
        for (const item of tree.data.tree) {
            if (item.mode === "040000") {
                let tree = await this.octokit.rest.git.getTree({
                    owner: this.owner,
                    repo: this.repo,
                    sha: item.sha,
                });
                await this._flat(tree, `${prefix}${item.path}/`)
            } else if (item.mode === "100644") {
                let file_sha = item.sha;
                this.files[`${prefix}${item.path}`] = file_sha;
            }
        }
    }

    static async fetch(octokit, owner, repo, ref, subpath) {
        const refdata = await octokit.rest.git.getRef({
            owner,
            repo,
            ref,
        });
        let commit_sha = refdata.data.object.sha;
        let commitdata = await octokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha,
        });
        let tree_sha = commitdata.data.tree.sha;
        let treedata = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha,
        });
        let recursive_trees = [treedata];
        if (subpath) {
            const comps = subpath.split('/');
            for (const comp of comps) {
                let subtree_sha = null;
                for (const item of treedata.data.tree) {
                    if (item.path === comp) {
                        subtree_sha = item.sha;
                        break;
                    }
                }
                if (!subtree_sha) {
                    recursive_trees.push(null);
                    break;
                } else {
                    treedata = await octokit.rest.git.getTree({
                        owner,
                        repo,
                        tree_sha: subtree_sha,
                    });
                    recursive_trees.push(treedata);
                }
            }
        }
        const flattree = new FlatTree(octokit, owner, repo, ref,
                                      commit_sha, recursive_trees, subpath);
        const last_tree = recursive_trees[recursive_trees.length - 1];
        if (last_tree !== null) {
            await flattree._flat(last_tree, '');
        }
        Object.assign(this.origin_files, this.files);
        return flattree;
    }


    async getFile(file_sha) {
        let text = this.store[file_sha];
        if (text === undefined) {
            let blob = await octokit.rest.git.getBlob({
                owner: this.owner,
                repo: this.repo,
                file_sha,
            });
            console.assert(blob.encoding === 'base64');
            let text = b64_to_utf8(blob.data.content);
            this.store[file_sha] = text;
        }
        return text;
    }

    async _upload_file(text) {
        const result = await this.octokit.rest.createBlob({
            owner: this.owner,
            repo: this.repo,
            content: text,
            encoding: 'utf-8',
        });
        return result.sha;
    }

    async _upload_tree(folders, prefix) {
        const tree = [];
        for (const subpath of folders.get(prefix)) {
            let path = `${prefix}${subpath}`
            if (folders.has(path)) {
                tree.push({path: subpath, mode: '040000', type: 'tree',
                           sha: await this._upload_tree(folders, path)});
            } else {
                const origin = this.origin_files[path];
                const write = this.files[path];
                let sha;
                if (write === null) {
                    sha = null;
                } else if (origin !== write) {
                    sha = await this._upload_file(this.store[write]);
                    console.assert(sha === write);
                } else {
                    sha = write;
                }
                if (sha) {
                    tree.push({path: subpath, mode: '100644', type: 'blob',
                           sha: sha});
                }
            }
        }
        const result = await this.octokit.rest.git.createTree({
            owner: this.owner,
            repo: this.repo,
            tree,
        });
        return result.sha;
    }


    async commit() {
        const folders = this.fold();
        let tree_sha = await this._upload_tree(folders, '');
        let message = 'Make some changes';

        // 從子目錄逆向組合至根目錄
        let comps = this.subpath.split('/');
        const zip = comps.map(function(e, i) {
            return [e, this.recursive_trees[i]];
        });
        comps.reverse();

        for (const [subpath, subtree] of zip) {
            const tree = [];
            if(!subtree) {
                tree.push({path: subpath, mode: '040000', type: 'tree',
                           sha: tree_sha});
            } else {
                for (const item of subtree.data.tree) {
                    if (item.path === subpath) {
                        tree.push({path: subpath, mode: '040000', type: 'tree',
                                   sha: tree_sha});
                    } else {
                        tree.push(item);
                    }
                }
            }
            const result = await this.octokit.rest.git.createTree({
                owner: this.owner,
                repo: this.repo,
                tree,
            });
            tree_sha = result.sha;
        }

        const result = await octokit.rest.git.createCommit({
            owner: this.owner,
            repo: this.repo,
            message,
            tree: tree_sha,
            // author.name,
            // author.email
            parents: [this.commit_sha],
        });
        const commit_sha = result.sha;
        const update_result = await octokit.rest.git.updateRef({
            owner: this.owner,
            repo: this.repo,
            ref: this.ref,
            sha: commit_sha,
        });
        console.log(update_result);
    }

}


