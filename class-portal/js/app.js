// ---------------- Firebase Configuration ----------------
const firebaseConfig = {
    apiKey: "AIzaSyBgQbuano-_wsvjr7YZH8uma8JYRS5fpU8",
    authDomain: "bce-class-portal.firebaseapp.com",
    projectId: "bce-class-portal",
    storageBucket: "bce-class-portal.firebasestorage.app",
    messagingSenderId: "989231393425",
    appId: "1:989231393425:web:27b53bccc263e2133b6d30"
};

// Initialize Firebase (using compat SDK only)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log('Firebase initialized successfully!');

// ---------------- Utility Functions ----------------
function showMessage(elementId, message, type = 'success') {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerText = message;
    element.className = type === 'success'
        ? 'text-green-600 dark:text-green-400 text-sm text-center'
        : 'text-red-500 dark:text-red-400 text-sm text-center';

    // Clear message after 5 seconds
    setTimeout(() => {
        element.innerText = '';
    }, 5000);
}

// ---------------- Login (Database-based Authentication) ----------------
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const index = document.getElementById("indexNumber").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!index || !password) {
            showMessage("errorMsg", "Please fill in all fields.", "error");
            return;
        }

        // Disable button during login
        loginBtn.disabled = true;
        loginBtn.innerText = "Logging in...";

        try {
            console.log('Attempting to login with:', index);
            
            // Check user in Firestore database using indexNumber as document ID
            const userDocRef = db.collection("users").doc(index);
            const doc = await userDocRef.get();
            
            if (!doc.exists) {
                throw new Error("Index number not found.");
            }

            const userData = doc.data();
            console.log('User data found:', userData);

            // Check if account is locked
            const now = new Date();
            if (userData.lockUntil && now < userData.lockUntil.toDate()) {
                const lockTime = userData.lockUntil.toDate().toLocaleTimeString();
                throw new Error(`Account locked until ${lockTime}. Try again later.`);
            }

            // Check password
            if (userData.password !== password) {
                // Increment failed attempts
                let attempts = (userData.failedAttempts || 0) + 1;
                let lockUntil = null;
                let errorMessage = "Incorrect password.";

                if (attempts >= 3) {
                    lockUntil = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour
                    attempts = 0;
                    errorMessage = "Too many failed attempts. Account locked for 1 hour.";
                } else {
                    errorMessage = `Incorrect password. ${3 - attempts} attempts remaining.`;
                }

                // Update failed attempts in database
                await userDocRef.update({
                    failedAttempts: attempts,
                    lockUntil: lockUntil
                });

                throw new Error(errorMessage);
            }

            // Success - Reset failed attempts
            await userDocRef.update({ 
                failedAttempts: 0, 
                lockUntil: null,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('Login successful!');

            // Store user session (simple approach)
            sessionStorage.setItem('currentUser', JSON.stringify({
                indexNumber: index,
                role: userData.role,
                isFirstLogin: userData.isFirstLogin || false
            }));

            // Redirect based on first login status
            if (userData.isFirstLogin) {
                window.location.href = "change-password.html";
            } else {
                // Redirect by role
                if (userData.role === "admin") {
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "dashboard.html";
                }
            }

        } catch (error) {
            console.error("Login error:", error);
            showMessage("errorMsg", error.message, "error");
        } finally {
            // Re-enable button
            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
        }
    });

    // Allow Enter key to submit login
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && (document.activeElement.id === 'indexNumber' || document.activeElement.id === 'password')) {
            loginBtn.click();
        }
    });
}

// ---------------- First-login password/email setup ----------------
const changeBtn = document.getElementById("changeBtn");
if (changeBtn) {
    changeBtn.addEventListener("click", async () => {
        const newPassword = document.getElementById("newPassword").value.trim();
        const personalEmail = document.getElementById("personalEmail").value.trim();

        if (!newPassword || !personalEmail) {
            showMessage("msg", "Please fill both fields.", "error");
            return;
        }

        if (newPassword.length < 6) {
            showMessage("msg", "Password must be at least 6 characters long.", "error");
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(personalEmail)) {
            showMessage("msg", "Please enter a valid email address.", "error");
            return;
        }

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser) {
            showMessage("msg", "Session expired. Please login again.", "error");
            window.location.href = "index.html";
            return;
        }

        changeBtn.disabled = true;
        changeBtn.innerText = "Updating...";

        try {
            // Update user document in Firestore
            const userDocRef = db.collection("users").doc(currentUser.indexNumber);
            await userDocRef.update({
                password: newPassword,
                email: personalEmail,
                isFirstLogin: false,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update session
            currentUser.isFirstLogin = false;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

            showMessage("msg", "Account setup complete! Redirecting...", "success");

            setTimeout(() => {
                if (currentUser.role === "admin") {
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "dashboard.html";
                }
            }, 2000);

        } catch (error) {
            console.error("Password change error:", error);
            showMessage("msg", "Error updating account: " + error.message, "error");
        } finally {
            changeBtn.disabled = false;
            changeBtn.innerText = "Save & Continue";
        }
    });
}

// ---------------- Session Check ----------------
function checkUserSession() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const currentPage = window.location.pathname.split('/').pop();

    if (!currentUser && currentPage !== 'index.html' && currentPage !== '') {
        // User not logged in, redirect to login
        window.location.href = 'index.html';
        return;
    }

    if (currentUser && (currentPage === 'index.html' || currentPage === '')) {
        // User is logged in but on login page, redirect appropriately
        if (currentUser.isFirstLogin) {
            window.location.href = 'change-password.html';
        } else if (currentUser.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }
}

// Check session on page load
document.addEventListener('DOMContentLoaded', checkUserSession);

// ---------------- Logout ----------------
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem('currentUser');
        window.location.href = "index.html";
    });
}

// ---------------- Admin Announcements ----------------
const postAnnouncementBtn = document.getElementById("postAnnouncementBtn");
if (postAnnouncementBtn) {
    postAnnouncementBtn.addEventListener("click", async () => {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser || currentUser.role !== 'admin') {
            showMessage("announceMsg", "Access denied. Admin only.", "error");
            return;
        }

        const title = document.getElementById("announcementTitle").value.trim();
        const content = document.getElementById("announcementContent").value.trim();

        if (!title || !content) {
            showMessage("announceMsg", "Please fill all fields.", "error");
            return;
        }

        if (title.length > 100) {
            showMessage("announceMsg", "Title is too long (max 100 characters).", "error");
            return;
        }

        postAnnouncementBtn.disabled = true;
        postAnnouncementBtn.innerText = "Posting...";

        try {
            await db.collection("announcements").add({
                title: title,
                content: content,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                postedBy: "Admin",
                authorId: currentUser.indexNumber
            });

            showMessage("announceMsg", "Announcement posted successfully!");

            // Clear form
            document.getElementById("announcementTitle").value = "";
            document.getElementById("announcementContent").value = "";

        } catch (error) {
            console.error("Announcement error:", error);
            showMessage("announceMsg", "Error posting announcement: " + error.message, "error");
        } finally {
            postAnnouncementBtn.disabled = false;
            postAnnouncementBtn.innerText = "Post Announcement";
        }
    });
}

// ---------------- Admin File Link Sharing ----------------
const shareFileLinkBtn = document.getElementById("shareFileLinkBtn");
if (shareFileLinkBtn) {
    shareFileLinkBtn.addEventListener("click", async () => {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser || currentUser.role !== 'admin') {
            showMessage("fileMsg", "Access denied. Admin only.", "error");
            return;
        }

        const fileName = document.getElementById("fileName").value.trim();
        const fileLink = document.getElementById("fileLink").value.trim();
        const description = document.getElementById("fileDescription").value.trim();

        if (!fileName || !fileLink) {
            showMessage("fileMsg", "Please fill in file name and link.", "error");
            return;
        }

        // Basic URL validation
        try {
            new URL(fileLink);
        } catch {
            showMessage("fileMsg", "Please enter a valid URL.", "error");
            return;
        }

        shareFileLinkBtn.disabled = true;
        shareFileLinkBtn.innerText = "Sharing...";

        try {
            await db.collection("shared_files").add({
                name: fileName,
                url: fileLink,
                description: description || "",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                sharedBy: "Admin",
                authorId: currentUser.indexNumber
            });

            showMessage("fileMsg", "File link shared successfully!");

            // Clear form
            document.getElementById("fileName").value = "";
            document.getElementById("fileLink").value = "";
            document.getElementById("fileDescription").value = "";

        } catch (error) {
            console.error("File sharing error:", error);
            showMessage("fileMsg", "Error sharing file: " + error.message, "error");
        } finally {
            shareFileLinkBtn.disabled = false;
            shareFileLinkBtn.innerText = "Share File Link";
        }
    });
}

// ---------------- Student Dashboard Announcements ----------------
const announcementsList = document.getElementById("announcementsList");
if (announcementsList) {
    // Show loading state
    announcementsList.innerHTML = `
        <div class="bg-white shadow-md rounded-xl p-5 border border-blue-100 text-center">
            <p class="text-gray-500">Loading announcements...</p>
        </div>
    `;

    db.collection("announcements")
        .orderBy("createdAt", "desc")
        .limit(20)
        .onSnapshot((snapshot) => {
            announcementsList.innerHTML = "";

            if (snapshot.empty) {
                announcementsList.innerHTML = `
                    <div class="bg-white shadow-md rounded-xl p-8 border border-blue-100 text-center">
                        <p class="text-gray-500 text-lg">📢 No announcements yet.</p>
                        <p class="text-gray-400 text-sm mt-2">Check back later for updates!</p>
                    </div>
                `;
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 'Just now';

                const card = `
                    <div class="bg-white shadow-md rounded-xl p-4 sm:p-5 border border-blue-100 hover:shadow-lg transition-shadow duration-200">
                        <h3 class="text-lg sm:text-xl font-semibold text-blue-600 mb-2 break-words">${escapeHtml(data.title)}</h3>
                        <p class="text-gray-700 mb-3 leading-relaxed break-words">${escapeHtml(data.content)}</p>
                        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm text-gray-400 space-y-1 sm:space-y-0">
                            <span>📝 Posted by ${escapeHtml(data.postedBy)}</span>
                            <span>🕒 ${date}</span>
                        </div>
                    </div>
                `;
                announcementsList.innerHTML += card;
            });
        }, (error) => {
            console.error("Error loading announcements:", error);
            announcementsList.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                    <p class="text-red-600">Error loading announcements. Please refresh the page.</p>
                </div>
            `;
        });
}

// ---------------- Student Dashboard Files ----------------
const filesList = document.getElementById("filesList");
if (filesList) {
    // Show loading state
    filesList.innerHTML = `
        <li class="bg-white border border-blue-100 shadow-sm rounded-lg px-4 py-3 text-center">
            <span class="text-gray-500">Loading files...</span>
        </li>
    `;

    db.collection("shared_files")
        .orderBy("createdAt", "desc")
        .limit(20)
        .onSnapshot((snapshot) => {
            filesList.innerHTML = "";

            if (snapshot.empty) {
                filesList.innerHTML = `
                    <li class="bg-white border border-blue-100 shadow-sm rounded-lg px-4 py-8 text-center">
                        <p class="text-gray-500 text-lg">📁 No files shared yet.</p>
                        <p class="text-gray-400 text-sm mt-2">Files shared by admin will appear here.</p>
                    </li>
                `;
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 'Just now';

                const li = `
                    <li class="bg-white border border-blue-100 shadow-sm rounded-lg px-4 py-3 hover:shadow-md transition-shadow duration-200">
                        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                            <div class="flex-1 min-w-0">
                                <h4 class="text-gray-800 font-semibold truncate">${escapeHtml(data.name)}</h4>
                                ${data.description ? `<p class="text-gray-600 text-sm mt-1 break-words">${escapeHtml(data.description)}</p>` : ''}
                                <div class="flex flex-col sm:flex-row sm:items-center text-xs text-gray-400 mt-1 space-y-1 sm:space-y-0 sm:space-x-4">
                                    <span>📤 Shared by ${escapeHtml(data.sharedBy)}</span>
                                    <span>🕒 ${date}</span>
                                </div>
                            </div>
                            <a href="${data.url}" target="_blank" rel="noopener" 
                               class="inline-block bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-3 py-2 rounded text-sm font-semibold transition duration-200 text-center touch-manipulation">
                                📥 Open File
                            </a>
                        </div>
                    </li>
                `;
                filesList.innerHTML += li;
            });
        }, (error) => {
            console.error("Error loading files:", error);
            filesList.innerHTML = `
                <li class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
                    <span class="text-red-600">Error loading files. Please refresh the page.</span>
                </li>
            `;
        });
}

// ---------------- Forgot Password ----------------
const forgotBtn = document.getElementById("forgotBtn");
if (forgotBtn) {
    forgotBtn.addEventListener("click", async () => {
        const index = document.getElementById("indexNumber").value.trim();

        if (!index) {
            showMessage("errorMsg", "Enter your index number first.", "error");
            return;
        }

        showMessage("errorMsg", "Please contact your administrator for password reset.", "error");
    });
}

// ---------------- Utility Functions ----------------
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

console.log('🚀 Class Portal loaded successfully!');