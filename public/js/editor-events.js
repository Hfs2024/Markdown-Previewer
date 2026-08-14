const saveStatus = NS("#save-status");
const modeStatus = NS("#mode-status");
let typingTimeout = null;

function saveDraft() {
    localStorage.setItem("draft", editor.getValue());
    saveStatus.setText("Saved");
}

editor.on("change", function () {
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(saveDraft, 1000);
    saveStatus.setText("Saving...");
    updatePreview();
    updateCount();
});

editor.on('paste', function (instance, e) {
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const length = editor.getValue().length;
    const newLength = length + pasted.length;
    const remain = max - length;

    if (newLength > max) {
        e.preventDefault();
        editor.setValue(editor.getValue() + pasted.slice(0, remain));
        updateCount();
    }
});

editor.on('keydown', function (instance, e) {
    const length = editor.getValue().length;
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Control', 'Alt'].includes(e.key)) return;
    if (length >= max) e.preventDefault();
});