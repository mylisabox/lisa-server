
const removeNull = (obj) => {
    if (!obj) {
        return obj;
    }
    Object.keys(obj).forEach(k => {
            if (obj[k] && typeof obj[k] === 'object') {
                removeNull(obj[k]);
            }
            if (obj[k] == null || obj[k] === undefined) {
                delete obj[k];
            }
        }
    );
    return obj;
}

export default removeNull;
