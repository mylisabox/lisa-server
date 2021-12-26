import {randomBytes, scrypt, timingSafeEqual} from "crypto";

export default {
    salt() {
        return randomBytes(16).toString("hex");
    },
    compare(password, hash) {
        return new Promise((resolve, reject) => {
            const [salt, key] = hash.split(":")
            const keyBuffer = Buffer.from(key, 'hex');
            scrypt(password, salt, 32, (err, derivedKey) => {
                if (err) {
                    return reject(err);
                }

                resolve(timingSafeEqual(keyBuffer, derivedKey))
            });
        })
    },
    getHash(password, salt) {
        return new Promise((resolve, reject) => {
            scrypt(password, salt, 32, (err, derivedKey) => {
                if (err) {
                    return reject(err);
                }
                resolve(salt + ":" + derivedKey.toString('hex'));
            });
        });
    }
}
