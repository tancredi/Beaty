var input = null;

function createInput (){
    input = document.createElement('input');

    input.style.display = 'none';
    input.type = 'file';

    document.body.appendChild(input);
}

function triggerClick () {
    if (document.createEvent) {
        var clickEvent = document.createEvent('MouseEvents');

        clickEvent.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false, 0, null
            );

        input.dispatchEvent(clickEvent);
    } else {
        input.fireEvent('onclick');
    }
}

function open (callback) {
    if (!input) { createInput(); }

    input.onchange = function () {
        var reader = new FileReader();

        reader.onload = function () {
            callback(reader.result);
        };

        reader.readAsDataURL(input.files[0]);
    };

    triggerClick();
}

module.exports = {
    open: open
};