async function showManageLinkModal(save, link) {
    // Reset
    pickerConfig.chosenExpiryTime = "1h";
    pickerConfig.status = "private";

    Swal.fire({
        titleText: `Manage ${save.title}'s Link`,
        html: "<div id='link-manage-container'></div>",
        confirmButtonText: "Close"
    });

    const container = NS("#link-manage-container");
    const linkCard = NS(NS.createEl("div", container, { className: "link" })).css({ backgroundColor: save.color });
    NS(NS.createEl("p", linkCard, { className: "link-expiry" })).html(`<b>Expires:</b> ${save.expiresAt ? new Date(save.expiresAt).toDateString() : "Never"}`);
    NS(NS.createEl("p", linkCard, { className: "link-status" })).html(`<b>Created At:</b> ${new Date(link.createdAt).toDateString()}`);
    NS(NS.createEl("p", linkCard, { className: "link-status" })).html(`<b>Status:</b> ${capitalizeFirstLetter(link?.status)}`);
    NS(NS.createEl("p", linkCard, { className: "link-status" })).html(`<b>Views:</b> ${link.views}`);
    const buttons = NS(NS.createEl("div", container, { className: "center-overflow" }));

    NS(NS.createEl("button", buttons, { className: "btn-max-width btn-danger" })).html("Delete Link").on("click", async function () {
        const deleteResponse = await NS.fetch({
            url: `/api/v1/delete-link/save/${save._id}`,
            method: "DELETE"
        });

        if (!deleteResponse.success) return Swal.fire(deleteResponse.error);
        Swal.fire("Success", "Deleted old link successfully!", "success");
    });

    NS(NS.createEl("button", buttons, { className: "btn-max-width" })).html("Toggle Status").on("click", async function () {
        const updateStatusResponse = await NS.fetch({
            url: `/api/v1/update-link-status/save/${save._id}`,
            method: "PUT",
            body: {
                newStatus: link?.status === "public" ? "private" : "public"
            }
        });

        if (!updateStatusResponse.success) return Swal.fire(updateStatusResponse.error);
        Swal.fire("Success", "Link updated!", "success");
    });
}

async function showCreateLinkModal(save) {
    Swal.fire({
        title: "Configure settings: ",
        html: `
            <hr>
            <h3>Expire In: </h3>
            <div class='center'>
              <button class='link-expiry-time-btn btn-picker on' data-time='1h' data-category='link-expiry-time'>1 Hour</button>
              <button class='link-expiry-time-btn btn-picker' data-time='never' data-category='link-expiry-time'>Never</button>
            </div><hr>

            <h3>Status: </h3>
            <div class='center'>
              <button id='status-private-btn' class='status-btn btn-picker on' data-status='private' data-category='status'>Private</button>
              <button id='status-public-btn' class='status-btn btn-picker' data-status='public' data-category='status'>Public</button>
            </div>

            <div id='burn-after-read-container'>
               <hr>
               <button id='burn-after-read' class='btn-max-width'>Burn after read</button><br><br>
            </div>
        `,

        didOpen: () => {
            // Expiry time
            createPicker({
                selector: ".link-expiry-time-btn",
                category: "link-expiry-time",
                items: [{
                    name: "time",
                    type: "string"
                }],
                variables: ["chosenExpiryTime"]
            });

            // Expire after read
            createPicker({
                selector: ".link-expire-read-btn",
                category: "link-expiry-read",
                items: [{
                    name: "expireRead",
                    type: "boolean"
                }],
                variables: ["expireAfterRead"]
            });

            // Status
            createPicker({
                selector: ".status-btn",
                category: "status",
                items: [{
                    name: "status",
                    type: "string"
                }],
                variables: ["status"]
            });

            NS("#status-public-btn").on("click", function () {
                NS("#burn-after-read-container").show();
            });

            NS("#status-private-btn").on("click", function () {
                NS("#burn-after-read-container").hide();
            });

            NS("#burn-after-read").on("click", function () {
                NS("#burn-after-read").toggleClass("on");
            });

            NS("#burn-after-read-container").hide();
        },
        showCancelButton: true,
    }).then(async result => {
        if (!result.isConfirmed) {
            pickerConfig.chosenExpiryTime = "1h";
            pickerConfig.status = "private";
            return;
        }

        const data = await NS.fetch({
            url: `/api/v1/create-link/save/${save._id}`,
            method: "POST",
            body: {
                expiresAt: pickerConfig.chosenExpiryTime,
                status: pickerConfig.status,
                burnAfterRead: pickerConfig.status === "public" ? NS("#burn-after-read").hasClass("on") : false
            }
        });

        pickerConfig.chosenExpiryTime = "1h";
        pickerConfig.status = "private";
        if (!data.success) return Swal.fire(data.error);
        Swal.fire("Success", "Link created!", "success");
    });
}

async function showProfile() {
    let data = await NS.fetch({
        url: "/api/v1/get/user-profile",
        method: "POST"
    });

    let skip = 0;

    if (!data.success) return Swal.fire(data.error);
    Swal.fire({
        title: `Welcome, ${capitalizeFirstLetter(data.username)}!`,
        html: `
          <hr>
          <p>You used <b>${data.savesCount}/50</b> saves</p>
          <div class='center'>
            <input type='text' placeholder='Search saves...' id='search-saves-input' />
          </div><br>

          <div id='saves-container'></div>
          <div class='center' style='margin-top: 10px'>
            <button id='user-saves-prev-btn'> 
                <i class='fas fa-caret-left'></i>
            </button>
            <button id='user-saves-next-btn'>
                <i class='fas fa-caret-right'></i>
            </button>
          </div>
        `,
        confirmButtonText: "Close"
    });

    const container = NS("#saves-container");
    const renderSaves = async () => {
        container.html("");

        if (data.saves.length <= 0) {
            NS(NS.createEl("div", container, {}))
                .html("<p class='nothing-found'>No saves yet.<p>");
            return;
        }

        data.saves.forEach(save => {
            const link = data.links.find(link => link.for === save._id);
            const saveCard = NS(NS.createEl("div", container, { className: "save" })).css({ backgroundColor: save.color });
            const saveHeader = NS.createEl("div", saveCard, { className: "space-between" });
            const buttons = NS.createEl("div", saveCard, { className: "center" });
            // Header
            NS(NS.createEl("h2", saveHeader, { className: "save-title" })).setText(save.title || "No title");
            const saveHeaderButtons = NS.createEl("div", saveHeader, { className: "center" });

            if (!link) NS(NS.createEl("i", saveHeaderButtons, { className: "fas fa-plus link-icon", title: "Create link", tabIndex: "0", role: "button" }))
                .on("click", async function () {
                    showCreateLinkModal(save);
                });
            else {
                if (!link.burned) {
                    NS(NS.createEl("i", saveHeaderButtons, { className: "fas fa-link link-icon", title: "Copy link", tabIndex: "0", role: "button" })).on("click", async function () {
                        NS.copy({
                            text: generateLink(save._id),
                            onSuccess: () => {
                                Swal.fire("Success", "Copied!", "success");
                            },
                            onFailure: () => {
                                Swal.fire("Error", "Failed to copy. Try again later.", "error");
                            }
                        });
                    });
                } else {
                    NS(NS.createEl("i", saveHeaderButtons, { className: "fas fa-arrow-rotate-left link-icon", title: "Restore", tabIndex: "0", role: "button" })).on("click", async function () {
                        const restoreLinkResponse = await NS.fetch({
                            url: `/api/v1/restore-link/save/${save._id}`,
                            method: "POST"
                        });

                        if (!restoreLinkResponse.success) return Swal.fire(restoreLinkResponse.error);
                        Swal.fire("Success", "Link restored for another use!", "success");
                    });
                }

                NS(NS.createEl("i", saveHeaderButtons, { className: "fas fa-briefcase link-icon", title: "Manage link", tabIndex: "0", role: "button" }))
                    .on("click", async function () {
                        showManageLinkModal(save, link);
                    });
            }

            NS(NS.createEl("i", saveHeaderButtons, { className: "fas fa-eye-dropper link-icon", title: "Pick a color", tabIndex: "0", role: "button" }))
                .on("click", function () {
                    Swal.fire({
                        title: "Pick a color: ",
                        html: `
                        <div class='center'>
                          <button class='save-color-btn btn-picker' data-color='#f8f9fa' data-category='save-color-btn'>Default</button>
                          <button class='save-color-btn btn-picker' data-color='#c5d9ec' data-category='save-color-btn'>Blue</button>
                          <button class='save-color-btn btn-picker' data-color='#83e6b5' data-category='save-color-btn'>Green</button>
                          <button class='save-color-btn btn-picker' data-color='#ee9595' data-category='save-color-btn'>Red</button>
                        </div>
                        `,
                        showCancelButton: true,
                        didOpen: () => {
                            createPicker({
                                selector: ".save-color-btn",
                                items: [{
                                    name: "color",
                                    type: "string"
                                }],
                                variables: ["color"],
                                category: "save-color-btn"
                            });

                            NS(".save-color-btn").each(btn => {
                                btn = NS(btn);
                                const color = btn.getDataSetItem("color")[0];
                                if (color === save.color) btn.addClass("on");
                            });
                        }
                    }).then(async result => {
                        if (!result.isConfirmed) {
                            pickerConfig.color = "#f8f9fa";
                            return;
                        }

                        const updateColorResponse = await NS.fetch({
                            url: `/api/v1/update/save/${save._id}`,
                            method: "PUT",
                            body: { color: pickerConfig.color }
                        });

                        if (!updateColorResponse.success) return Swal.fire(updateColorResponse.error);
                        Swal.fire("Success", "Color updated!", "success");
                    });
                });

            // Search saves
            NS("#search-saves-input").on("input", function () {
                if (data.saves.length <= 0) return;
                let foundOne = false;
                NS(".save").each(save => {
                    save = NS(save);
                    const text = NS(save.get(".save-title")[0]).getText()[0].toLowerCase();
                    if (text.includes(NS("#search-saves-input").getVal()[0].toLowerCase().trim())) {
                        foundOne = true;
                        save.css({ display: "block" });
                    } else save.css({ display: "none" });
                });

                if (!foundOne) {
                    if (container.get(".nothing-found")[0]) return;
                    NS(NS.createEl("h2", container, { className: "nothing-found" }))
                        .setText("No saves yet.");
                }
                else NS(".nothing-found").remove();
            });

            // Show content
            NS(NS.createEl("button", buttons, { className: "btn-max-width" }))
                .setText("View")
                .on("click", function () {
                    editor.setValue(save.content);
                    updateCount();
                    updatePreview();
                    saveId = save._id;
                    saveTitle = save.title;
                    modeStatus.setText("SaveEdit");
                    Swal.clickConfirm();
                });

            // Delete
            NS(NS.createEl("button", buttons, { className: "btn-max-width btn-danger" }))
                .setText("Delete")
                .on("click", async function () {
                    const deleteResponse = await NS.fetch({
                        url: `/api/v1/delete/save/${save._id}`,
                        method: "DELETE"
                    });

                    if (!deleteResponse.success) return Swal.fire(deleteResponse.error);
                    Swal.fire("Success!", "Deleted!", "success");
                    saveId = save._id === saveId ? null : saveId;
                    saveTitle = saveId ? saveTitle : "";
                    setMode(saveId ? "SaveEdit" : "LocalEdit");
                    updateCount();
                    updatePreview();
                });
        });
    }

    // Nav
    NS("#user-saves-prev-btn").on("click", async function () {
        if (skip <= 0) return;
        skip -= 10;

        data = await NS.fetch({
            url: `/api/v1/get/user-profile/?skip=${skip}`,
            method: "POST"
        });

        renderSaves();
    });

    NS("#user-saves-next-btn").on("click", async function () {
        if (container.get(".nothing-found")[0]) return;
        skip += 10;

        data = await NS.fetch({
            url: `/api/v1/get/user-profile/?skip=${skip}`,
            method: "POST"
        });

        renderSaves();
    });

    // Init
    renderSaves();
    runAccessibility();
}