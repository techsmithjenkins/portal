// ---------------- Firebase Init ----------------
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ---------------- Login ----------------
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const index = document.getElementById("indexNumber").value.trim();
        const password = document.getElementById("password").value.trim();
        const email = `${index}@student.local`; // placeholder email

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Fetch Firestore user doc
            const userDocRef = db.collection("users").doc(user.uid);
            const doc = await userDocRef.get();
            if (!doc.exists) throw new Error("User profile not found.");

            const data = doc.data();

            // Check lockout
            const now = new Date();
            if (data.lockUntil && now < data.lockUntil.toDate()) {
                throw new Error(`Account locked. Try again later.`);
            }

            // If first login, redirect to change-password
            if (data.firstLogin) {
                window.location.href = "change-password.html";
            } else {
                // Redirect by role
                if (data.role === "admin") window.location.href = "admin.html";
                else window.location.href = "dashboard.html";
            }

        } catch (error) {
            document.getElementById("errorMsg").innerText = error.message;

            // Increment failedAttempts
            if (error.code === "auth/wrong-password") {
                try {
                    const userSnapshot = await db.collection("users").where("indexNumber", "==", index).get();
                    if (!userSnapshot.empty) {
                        const userDoc = userSnapshot.docs[0];
                        const userData = userDoc.data();
                        let attempts = (userData.failedAttempts || 0) + 1;
                        let lockUntil = null;
                        if (attempts >= 3) {
                            lockUntil = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 60*60*1000)); // 1 hour
                            attempts = 0;
                        }
                        await db.collection("users").doc(userDoc.id).update({failedAttempts: attempts, lockUntil});
                    }
                } catch(e) { console.log(e); }
            }
        }
    });
}

// ---------------- First-login password/email setup ----------------
const changeBtn = document.getElementById("changeBtn");
if (changeBtn) {
    changeBtn.addEventListener("click", async () => {
        const newPassword = document.getElementById("newPassword").value.trim();
        const personalEmail = document.getElementById("personalEmail").value.trim();
        const user = auth.currentUser;

        if (!newPassword || !personalEmail) {
            document.getElementById("msg").innerText = "Please fill both fields.";
            return;
        }

        try {
            // Update password
            await user.updatePassword(newPassword);
            // Update email
            await user.updateEmail(personalEmail);
            // Update Firestore
            const userDocRef = db.collection("users").doc(user.uid);
            await userDocRef.update({
                email: personalEmail,
                firstLogin: false
            });

            document.getElementById("msg").innerText = "Account setup complete!";
            setTimeout(async () => {
                const userData = await userDocRef.get();
                const role = userData.data().role;
                if (role === "admin") window.location.href = "admin.html";
                else window.location.href = "dashboard.html";
            }, 1000);
        } catch (error) {
            document.getElementById("msg").innerText = error.message;
        }
    });
}

// ---------------- Logout ----------------
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await auth.signOut();
        window.location.href = "index.html";
    });
}

// ---------------- Admin Announcements ----------------
const postAnnouncementBtn = document.getElementById("postAnnouncementBtn");
if (postAnnouncementBtn) {
    postAnnouncementBtn.addEventListener("click", async () => {
        const title = document.getElementById("announcementTitle").value.trim();
        const content = document.getElementById("announcementContent").value.trim();
        if (!title || !content) {
            document.getElementById("announceMsg").innerText = "Please fill all fields.";
            return;
        }
        try {
            await db.collection("announcements").add({
                title,
                content,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                postedBy: "Admin"
            });
            document.getElementById("announceMsg").innerText = "Announcement posted!";
        } catch(err) {
            document.getElementById("announceMsg").innerText = err.message;
        }
    });
}

// ---------------- Admin File Upload ----------------
const uploadFileBtn = document.getElementById("uploadFileBtn");
if (uploadFileBtn) {
    uploadFileBtn.addEventListener("click", async () => {
        const file = document.getElementById("fileInput").files[0];
        if (!file) {
            document.getElementById("fileMsg").innerText = "No file selected.";
            return;
        }
        try {
            const storageRef = storage.ref("files/" + file.name);
            await storageRef.put(file);
            document.getElementById("fileMsg").innerText = "File uploaded successfully!";
        } catch(err) {
            document.getElementById("fileMsg").innerText = err.message;
        }
    });
}

// ---------------- Student Dashboard Announcements ----------------
const announcementsList = document.getElementById("announcementsList");
if (announcementsList) {
    db.collection("announcements").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        announcementsList.innerHTML = "";
        if (snapshot.empty) {
            announcementsList.innerHTML = "<p class='text-gray-500'>No announcements yet.</p>";
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : '';
            const card = `
                <div class="bg-white shadow-md rounded-xl p-5 border border-blue-100">
                  <h3 class="text-xl font-semibold text-blue-600 mb-2">${data.title}</h3>
                  <p class="text-gray-700 mb-2">${data.content}</p>
                  <p class="text-sm text-gray-400">Posted by ${data.postedBy} • ${date}</p>
                </div>`;
            announcementsList.innerHTML += card;
        });
    });
}

// ---------------- Student Dashboard Files ----------------
const filesList = document.getElementById("filesList");
if (filesList) {
    const storageRef = storage.ref("files/");
    storageRef.listAll().then(res => {
        filesList.innerHTML = "";
        if (res.items.length === 0) {
            filesList.innerHTML = "<p class='text-gray-500'>No files uploaded yet.</p>";
            return;
        }
        res.items.forEach(itemRef => {
            itemRef.getDownloadURL().then(url => {
                const li = `
                <li class="bg-white border border-blue-100 shadow-sm rounded-lg px-4 py-3 flex justify-between items-center">
                  <span class="text-gray-700">${itemRef.name}</span>
                  <a href="${url}" target="_blank" class="text-blue-600 hover:text-blue-800 font-semibold">Download</a>
                </li>`;
                filesList.innerHTML += li;
            });
        });
    }).catch(err => {
        filesList.innerHTML = `<p class='text-red-500'>Error loading files: ${err.message}</p>`;
    });
}

// ---------------- Forgot Password ----------------
const forgotBtn = document.getElementById("forgotBtn");
if (forgotBtn) {
    forgotBtn.addEventListener("click", async () => {
        const index = document.getElementById("indexNumber").value.trim();
        if (!index) {
            document.getElementById("errorMsg").innerText = "Enter your index number first.";
            return;
        }
        try {
            const userSnapshot = await db.collection("users").where("indexNumber", "==", index).get();
            if (userSnapshot.empty) throw new Error("Index number not found.");
            const email = userSnapshot.docs[0].data().email;
            await auth.sendPasswordResetEmail(email);
            document.getElementById("errorMsg").innerText = `Password reset email sent to ${email}`;
        } catch(err) {
            document.getElementById("errorMsg").innerText = err.message;
        }
    });
}
