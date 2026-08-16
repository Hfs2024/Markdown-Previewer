// Accessibility
function runAccessibility() {
    NS("[role='button']").each(btn => {
        btn = NS(btn);
        btn.on("keydown", function (e) {
            if (e.key === "Enter") btn.click();
        });
    });
}

// Password eye icon
function setUpEyeIcon() {
    NS(".password-eye").on("click", function () {
        const type = NS("#password").attr("type");
        const newType = type === "text" ? "password" : "text";
        const isText = newType === "text";
        NS("#password").attr("type", newType);
        NS(".password-eye").replaceClass(`fa-${isText ? "eye" : "eye-slash"}`, `fa-${isText ? "eye-slash" : "eye"}`);
    });
}

// Picker config
const pickerConfig = {
    file: "html",
    content: "",
    chosenExpiryTime: "1h",
    status: "private",
    color: "#f8f9fa"
}

// Clean HTML
function cleanHTML(html) {
    return DOMPurify.sanitize(marked.parse(html), {
        ALLOWED_TAGS: [
            "pre", "code", "b", "table", "tr", "td", "th", "thead", "tfoot", "tbody",
            "b", "i", "br", "span", "em", "strong", "u", "s", "sub", "sup", "small",
            "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ul", "ol", "li",
            "blockquote", "cite", "q"
        ]
    });
}

// Set mode
function setMode(mode) {
    modeStatus.setText(mode);
}

// Export
function exportFile({ content, type, fileName = "code" } = {}) {
    const blob = new Blob([content], { type: `text/${type}` });
    const url = URL.createObjectURL(blob);

    NS(NS.createEl("a", document.body, { style: "display: none" }))
        .attr("href", url)
        .attr("download", `${fileName || "code"}.${type}`)
        .click()
        .remove();

    URL.revokeObjectURL(url);
    pickerConfig.file = "html";
    pickerConfig.content = "";
    Swal.fire("Success", "Exported successfully!", "success");
}

// Picker
function createPicker({
    selector = "",
    items = [],
    variables = [],
    category = "",
    onClick
} = {}) {
    if (!Array.isArray(items) || !Array.isArray(variables) || !selector || !category) return console.error("Invalid picker configuration");

    NS(selector).each(btn => {
        btn = NS(btn);
        btn.on("click", function () {
            NS(`.on[data-category="${category}"]`).removeClass("on");
            btn.addClass("on");
            for (let i = 0; i < variables.length; i++) {
                const value = btn.getDataSetItem(items[i].name)[0];
                pickerConfig[variables[i]] =
                    items[i]?.type === "number" ? Number(value) // Converts strings to numbers
                        : items[i]?.type === "boolean" ? Boolean(value) // Converts strings to booleans (Note: If you pass false as a string, it will return true)
                            : value; // Default string 
            }

            if (typeof onClick === "function") onClick();
        });
    });
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
    return string.split("")[0].toUpperCase() + string.split("").slice(1).join("");
}

// Generate link
function generateLink(id) {
    return `http://localhost:3000/?id=${id}`;
}

// Init
runAccessibility();