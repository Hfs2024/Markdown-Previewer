const theme = localStorage.getItem("theme") || "light";
if (theme === "dark") document.body.classList.add("dark");

NS("#toggle-theme-btn").on("click", function () {
    if (document.body.classList.contains("dark")) localStorage.setItem("theme", "light");
    else localStorage.setItem("theme", "dark");

    document.body.classList.toggle("dark");
});