const preview = NS(".CodePreview");
const count = NS("#count");
const clearBtn = NS("#clear-btn");
const copyBtn = NS("#copy-btn");
const downloadBtn = NS("#download-btn");
const showEditBtn = NS("#show-edit-btn");
const saveBtn = NS("#save-btn");
const showPreviewBtn = NS("#show-preview-btn");
const editContainer = NS(".edit-container");
const previewContainer = NS(".preview-container");
const draft = localStorage.getItem("draft") || "";
const max = 10000;
const editor = CodeMirror.fromTextArea(NS("#edit-textarea")[0], {
    lineNumbers: true,
    mode: "markdown",
    theme: 'dracula',
    highlightFormatting: true
});
const query = new URLSearchParams(window.location.search);
const defaultString = `You seem so tired, deep in thought,
With every question and answer you brought.
So as a gift to ease your view,
I built a markdown previewer for you.

## A Little Rest for Your Code
* Crisp headers shine so bright and clear,
* Soft lists and tables now appear,
* No walls of text to strain your mind,
* Just tidy code left far behind.
* Then shouldn't you come here and never hide?

| Before | After |
| :--- | :--- |
| Bad design | Clean design |
| Weary Look | Refreshed view |

So take a break and watch it glow,
And let your mind take a break and slow.
`;
let saveId = null;
let saveTitle = "";

/* Editor */
function updatePreview() {
    preview.html(cleanHTML(editor.getValue()));
}

function updateCount() {
    count.setText(`${editor.getValue().length.toLocaleString()}/${max.toLocaleString()}`);
}

async function renderEditorContent() {
    const id = query.get("id");

    if (id) {
        const data = await NS.fetch({
            url: `/api/v1/get/save-from-link/${id}`
        });

        if (!data.success) return Swal.fire(data.error);
        editor.setValue(data.content);
    } else editor.setValue(draft || defaultString);
    updateCount();
}

// Button actions
showPreviewBtn.on("click", function () {
    editContainer.css({ display: "none" });
    previewContainer.css({ display: "flex" });
}).click(-2);

showEditBtn.on("click", function () {
    editContainer.css({ display: "flex" });
    previewContainer.css({ display: "none" });
});

saveBtn.on("click", async function () {
    Swal.fire({
        title: "Enter title (Max 10 chars)...",
        input: "text",
        inputPlaceholder: "Enter title...",
        inputValue: saveTitle,
        showCancelButton: true,
        preConfirm: result => {
            if (!result) return Swal.showValidationMessage("Don't forget the title!");
            if (result.length > 10) return Swal.showValidationMessage("Title must be less than 10 chars!");
        }
    }).then(async result => {
        if (!result.isConfirmed || !result.value) return;

        const data = await NS.fetch({
            url: saveId ? `/api/v1/update/save/${saveId}` : "/api/v1/saves",
            method: saveId ? "PUT" : "POST",
            body: {
                content: editor.getValue(),
                title: result.value
            }
        });

        saveId = null;
        saveTitle = "";
        setMode("LocalEdit");
        if (!data.success) return Swal.fire(data.error);
        Swal.fire("Success", "Successfully saved!", "success");
    });
});

clearBtn.on("click", function () {
    editor.setValue("");
    saveDraft();
    Swal.fire("Success", "Cleared!", "success");
});

copyBtn.on("click", function () {
    NS.copy({
        text: editor.getValue().trim(),
        onSuccess: () => {
            Swal.fire("Success", "Copied!", "success");
        },
        onFailure: () => {
            Swal.fire("Error", "Failed to copy. Try again later.", "error");
        }
    });
});

downloadBtn.on("click", function () {
    Swal.fire({
        title: "Choose type: ",
        input: "text",
        inputPlaceholder: "File name...",
        html: `
          <div class='center'>
             <button class='download-type-btn btn-picker on' data-file='html' data-category='file-type-download'>HTML</button>
             <button class='download-type-btn btn-picker' data-file='md' data-category='file-type-download'>Markdown</button>
          </div>
        `,
        didOpen: () => {
            createPicker({
                selector: ".download-type-btn",
                items: [{
                    name: "file",
                    type: "string"
                }, {
                    name: "content",
                    type: "string"
                }],
                variables: ["file", "content"],
                category: "file-type-download"
            });
        },
        showCancelButton: true
    }).then(result => {
        if (!result.isConfirmed) {
            pickerConfig.file = "html";
            pickerConfig.content = "";
            return;
        }

        const content = pickerConfig.file === "html" ?
            `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Page</title><style>pre{background-color:#eee;overflow:auto;border-radius:20px;padding:15px;}blockquote{margin:20px 0;padding:10px;background-color:#f8f9fa;border-left:5px solid #3b82f6;border-radius:0 8px 8px 0;font-family:'Georgia', serif;font-size:20px;font-style:italic;color:#334155;}img{width:100%;height:auto;border-radius:10px;}th,td{border-bottom:2px solid #eee;padding:10px;}</style></head><body>${preview.html()}</body></html>` // Don't export with any styles
            : pickerConfig.file === "md" ?
                editor.getValue().trim() : pickerConfig.content;

        exportFile({
            content: content,
            type: pickerConfig.file,
            fileName: result.value
        });
    });
});

/* Init */
renderEditorContent();
updatePreview();