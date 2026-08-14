const loggedInGroup = NS("#loggeIn-group");
const signUpBtn = NS("#signup-btn");
const profileBtn = NS("#profile-btn");
const signOutBtn = NS("#signout-btn");
const loginForm = `
            <h2>Login</h2>
            <input type="username" id="username" placeholder="Username"><br><br>
            <input type="password" id="password" placeholder="Password"><br><br>
            <div class="swal-toggle-text">
                Need an account? <span class="swal-toggle" onclick="showSignUpModal()">Sign up</span>
            </div>
        `;
const signupForm = `
            <h2>Sign Up</h2>
            <input type="text" id="username" placeholder="Username"><br><br>
            <input type="password" class="password-input" id="password" placeholder="Password"><br><br>   
            <div class="swal-toggle-text">
                Already have an account? <span class="swal-toggle" onclick="showLoginModal()">Log in</span>
            </div>
        `;

async function checkUserStatus() {
    const data = await NS.fetch({
        url: "/api/v1/get/user-status"
    });

    if (data.loggedIn) {
        signUpBtn.hide();
        loggedInGroup.show();
    } else {
        signUpBtn.show();
        loggedInGroup.hide();
    }
}

function showModal({
    html = "",
    type = "signup",
    onSuccess
}) {
    Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        preConfirm: () => {
            const username = Swal.getPopup().querySelector('#username').value;
            const password = Swal.getPopup().querySelector('#password').value;

            if (!username || !password) return Swal.showValidationMessage(`Please enter both username and password`);
        }
    }).then(async result => {
        if (!result.isConfirmed) return;

        const data = await NS.fetch({
            url: `/api/v1/${type}`,
            method: "POST",
            body: {
                username: NS('#username').getVal()[0],
                password: NS('#password').getVal()[0]
            }
        });

        if (!data.success) return Swal.fire(data.error);
        checkUserStatus();
        if (typeof onSuccess === "function") onSuccess(data);
    });
}

function showLoginModal() {
    showModal({
        html: loginForm,
        type: "login",
        onSuccess: () => {
            Swal.fire("Success", "Logged in successfully!", "success")
        }
    });
}

function showSignUpModal() {
    showModal({
        html: signupForm,
        type: "signup",
        onSuccess: data => {
            Swal.fire("Success", "Account created successfully!", "success");
        }
    });
}

// Attach events
signUpBtn.on("click", function () {
    showSignUpModal();
});

signOutBtn.on("click", async function () {
    const data = await NS.fetch({
        url: "/api/v1/signout",
        method: "POST"
    });

    if (!data.success) return Swal.fire(data.error);
    Swal.fire("Success", "You have been logged out successfully!", "success");
    checkUserStatus();
});

profileBtn.on("click", function () {
    showProfile();
});

checkUserStatus();