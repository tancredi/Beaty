function encodeBlob (blob, callback) {
    var reader = new FileReader();

    reader.addEventListener('loadend', function () {
        callback(reader.result);
    });

    reader.readAsDataURL(blob);
}

function decodeBlob (dataURI, dataTYPE) {
    var binary = atob(dataURI.split(',')[1]), array = [];

    for (var i = 0; i < binary.length; i+= 1) {
        array.push(binary.charCodeAt(i));
    }

    return new Blob([ new Uint8Array(array) ], { type: dataTYPE });
}

module.exports = {
    encode: encodeBlob,
    decode: decodeBlob
};