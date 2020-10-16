// Backend helper for app.html

/*
 * Just in case people come and look at this in the year 2050...
 *
 * Written by Vincent Kwok (CryptoAlgo) in 2020
 * (c) 2020-2020
 *
 * Chatty is distributed under the terms of the GNU General Public License Version 3.
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * CryptoAlgo Inc., hereby disclaims all copyright interest in the program “Chatty”
 * (which allows secure online communication between 2 or more people) written by Vincent Kwok.
 *
 * Vincent Kwok, 26 September 2020
 * Owner of CryptoAlgo
 */

// Secure number generator

function secureRandom(count, options) {
    options = options || {type: 'Array'}
    //we check for process.pid to prevent browserify from tricking us
    if (
        typeof process != 'undefined'
        && typeof process.pid == 'number'
        && process.versions
        && process.versions.node
    ) {
        return nodeRandom(count, options)
    } else {
        const crypto = window.crypto || window.msCrypto;
        if (!crypto) throw new Error("Your browser does not support window.crypto.")
        return browserRandom(count, options)
    }
}

function nodeRandom(count, options) {
    const crypto = require('crypto');
    const buf = crypto.randomBytes(count);

    switch (options.type) {
        case 'Array':
            return [].slice.call(buf)
        case 'Buffer':
            return buf
        case 'Uint8Array':
            var arr = new Uint8Array(count)
            for (var i = 0; i < count; ++i) { arr[i] = buf.readUInt8(i) }
            return arr
        default:
            throw new Error(options.type + " is unsupported.")
    }
}

function browserRandom(count, options) {
    const nativeArr = new Uint8Array(count);
    const crypto = window.crypto || window.msCrypto;
    crypto.getRandomValues(nativeArr)

    switch (options.type) {
        case 'Array':
            return [].slice.call(nativeArr)
        case 'Buffer':
            try { var b = new Buffer(1) } catch(e) { throw new Error('Buffer not supported in this environment. Use Node.js or Browserify for browser support.')}
            return new Buffer(nativeArr)
        case 'Uint8Array':
        case 'Uint8Array':
            return nativeArr
        default:
            throw new Error(options.type + " is unsupported.")
    }
}

secureRandom.randomArray = function(byteCount) {
    return secureRandom(byteCount, {type: 'Array'})
}

secureRandom.randomUint8Array = function(byteCount) {
    return secureRandom(byteCount, {type: 'Uint8Array'})
}

secureRandom.randomBuffer = function(byteCount) {
    return secureRandom(byteCount, {type: 'Buffer'})
}

document.body.addEventListener('MDCDrawer:closed', function() {
    document.body.querySelector('input, button').focus();
});

function updateTheme() {
    const body = document.body;
    if (localStorage.getItem('theme') === 'light') {
        if (!body.classList.contains('light')) body.classList.add('light');
    }
    else if (body.classList.contains('light')) body.classList.remove('light');
}

function openJoinGrpDialog() {
    // Reset dialog
    document.getElementById('create-group').classList.add('hidden');
    document.getElementById('join-group').classList.add('hidden');
    document.getElementById('dialog-opts').style.display = 'block';
    new window.mdc.dialog.MDCDialog(document.querySelector('.mdc-dialog')).open()
}

// The juicy part starts here

// Get loading bar ref
const progressBar = document.querySelector('.mdc-linear-progress');

function generateRandomUUID() { // Helper function for generating user and group UUIDs
    let dt = new Date().getTime();
    return 'xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c==='x' ? r :(r&0x3|0x8)).toString(16);
    });
} // End generateRandomUUID

// First we need to check if the user already has a generated UUID
if(localStorage.getItem('userUUID') === null) localStorage.setItem('userUUID', generateRandomUUID()); // Generate one
// Then, store the UUID in a varable
const userUUID = localStorage.getItem('userUUID');

// Init various MDC elements
const snackbar = new mdc.snackbar.MDCSnackbar(document.querySelector('.mdc-snackbar'));

// Get a reference to the database service
const database = firebase.database();

let selectedGroup = "";
const msgArea = document.querySelector('.messages-area');

let firstTimeScrolling = true;

// ENCRYPTION ---------
// ====================
function encryptMessage(msg, key=null, iv=null) {
    let aesCbc;
    if (key === null) aesCbc = new aesjs.ModeOfOperation.cbc(_base64ToArrayBuffer(groupData[selectedGroup].AESKey),
        _base64ToArrayBuffer(groupData[selectedGroup].AESIV));
    else aesCbc = new aesjs.ModeOfOperation.cbc(_base64ToArrayBuffer(key), _base64ToArrayBuffer(iv));
    const encryptedBytes = aesCbc.encrypt(
        aesjs.padding.pkcs7.pad(aesjs.utils.utf8.toBytes(msg)));
    return(_arrayBufferToBase64(encryptedBytes));
}
// DECRYPTION ---------
// --------------------
function decryptMessage(encrypted, key=null, iv=null) {
    const encryptedByteArray = _base64ToArrayBuffer(encrypted);
    // Create new obj for isolation
    let aesCbc;
    if (key === null) aesCbc = new aesjs.ModeOfOperation.cbc(_base64ToArrayBuffer(groupData[selectedGroup].AESKey),
        _base64ToArrayBuffer(groupData[selectedGroup].AESIV));
    else aesCbc = new aesjs.ModeOfOperation.cbc(_base64ToArrayBuffer(key), _base64ToArrayBuffer(iv));
    return aesjs.utils.utf8.fromBytes(aesjs.padding.pkcs7.strip(aesCbc.decrypt(encryptedByteArray)));
}
// ====================


// ====================
function addListInvite(content) {
    // ------------
    // Click listeners
    const acceptClicked = function() {
        const grpObj = content.split(',');

        const encryptor = new JSEncrypt();
        encryptor.setPublicKey(grpObj[0]);

        database.ref('encryptedAESKeys/' + grpObj[1]).set({
            EncryptedAES: encryptor.encrypt(groupData[selectedGroup].AESKey + ',' +
                groupData[selectedGroup].AESIV),
            GrpName: groupData[selectedGroup].grpName,
            GrpUUID: selectedGroup,
        });
    }
    // ------------
    const rejClicked = function() {
        database.ref('encryptedAESKeys/' + content.split(',')[1]).set({
            EncryptedAES: 'rej',
            GrpName: groupData[selectedGroup].grpName,
            GrpUUID: selectedGroup,
        });
    }

    // Holder <div>
    const inviteHolder = document.createElement('div');
    inviteHolder.classList.add('join-grp-request');

    // Invite <p> tag
    const infoText = document.createElement('p');
    infoText.innerHTML =
        'A user has requested to join this group<br>\n' +
        'Do you accept the request?';

    // Action holder <div> for buttons
    const actionHolder = document.createElement('div');
    actionHolder.classList.add('action-holder');

    // Accept button
    const acceptBtn = document.createElement('button');
    acceptBtn.classList.add('mdc-button', 'mdc-button--raised', 'colorful-button');
    const acceptBtnRipple = document.createElement('div');
    acceptBtnRipple.classList.add('mdc-button__ripple');
    const acceptBtnLabel = document.createElement('span');
    acceptBtnLabel.classList.add('mdc-button__label');
    acceptBtnLabel.innerHTML = 'Accept Request';
    acceptBtn.appendChild(acceptBtnRipple);
    acceptBtn.appendChild(acceptBtnLabel);
    acceptBtn.onclick = acceptClicked;

    // Decline button
    const rejButton = document.createElement('button');
    rejButton.classList.add('mdc-button', 'mdc-button--raised', 'dull-button');
    const rejBtnRipple = document.createElement('div');
    rejBtnRipple.classList.add('mdc-button__ripple');
    const rejBtnLabel = document.createElement('span');
    rejBtnLabel.classList.add('mdc-button__label');
    rejBtnLabel.innerHTML = 'Deny Request';
    rejButton.appendChild(rejBtnRipple);
    rejButton.appendChild(rejBtnLabel);
    rejButton.onclick = rejClicked;

    // Add all the various elements to their parents
    actionHolder.appendChild(acceptBtn);
    actionHolder.appendChild(rejButton);
    inviteHolder.appendChild(infoText);
    inviteHolder.appendChild(actionHolder);

    msgArea.appendChild(inviteHolder);

    // Init MDC elements
    new mdc.ripple.MDCRipple(acceptBtn);
    new mdc.ripple.MDCRipple(rejButton);
}
// ====================

function scrollToBottom() {
    const targetScroll = msgArea.scrollHeight - msgArea.clientHeight; // To ensure the page is really at bottom
    let scrollPos = msgArea.scrollTop;
    const scrollStep = (targetScroll - scrollPos) / 35; // Finish the animation in 35ms
    const scrollAnimation = setInterval(function() {
        msgArea.scrollTop = scrollPos;
        scrollPos += scrollStep;
        // Stop interval when scroll reaches bottom
        if (scrollPos >= targetScroll) clearInterval(scrollAnimation);
    }, 1);
}

// ====================
function refreshList() {
    progressBar.style.display = 'block';
    // Update group name
    document.querySelector('.mdc-top-app-bar__title').innerHTML =
        groupData[selectedGroup].grpName;
    // Clear messages
    document.querySelector('.messages-area').textContent = ''; // Delete all messages
    // Async change listener
    database.ref('messages/' + selectedGroup).on('value', function(snapshot) {
        progressBar.style.display = 'none';
        const placeHolderText = document.getElementById('no-msg-text');
        if (placeHolderText) placeHolderText.remove();
        const msgCount = msgArea.childElementCount;
        let addedCount = 0;
        // Add message items
        snapshot.forEach(function(it) {
            if (addedCount < msgCount) {
                addedCount++;
                return;
            }
            if (it.val().Author === 'specialGrpRequest') {
                addListInvite(it.val().Content, it.key);
                scrollToBottom();
                return; // Skip rest of addMsg
            }
            const msgText = document.createElement('p');
            const msg = decryptMessage(it.val().Content)
            msgText.innerHTML = msg;
            const links = msg.match(
                new RegExp(
                    "(^|[ \t\r\n])((ftp|http|https|gopher|mailto|news|nntp|telnet|wais|file|prospero|aim|webcal):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))"
                    ,"g"
                ));
            const msgHolder = document.createElement('div');
            if (links !== null) {
                for (let i = 0; i < links.length; i++) {
                    if (links[i].includes('www.youtube.com/watch?')) {
                        // Extract video ID
                        const vidID =
                            links[i].match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&]+)/)[1].toString();

                        // Create iFrame
                        const vidIFrame = document.createElement('iframe');
                        vidIFrame.frameBorder = '0';
                        vidIFrame.sandbox.add('allow-scripts', 'allow-same-origin'); // Block redirects
                        vidIFrame.setAttribute('allowfullscreen', 'allowfullscreen');

                        vidIFrame.src = 'https://www.youtube-nocookie.com/embed/' + vidID;

                        vidIFrame.setAttribute('srcdoc', "<style>*{padding:0;margin:0;overflow:hidden}html,body{height:100%}img,span{position:absolute;width:100%;top:0;bottom:0;margin:auto}span{height:1.5em;text-align:center;font:48px/1.5 sans-serif;color:white;text-shadow:0 0 0.5em black}</style><a href=https://www.youtube-nocookie.com/embed/" + vidID + "?autoplay=1><img src=https://img.youtube.com/vi/" + vidID + "/hqdefault.jpg><span>▶</span></a>");

                        vidIFrame.classList.add('inlineYTPlayer');

                        // Create IFrame holder
                        const IFrameHolder = document.createElement('div');
                        IFrameHolder.classList.add('iframe-holder')

                        // Add to holder
                        IFrameHolder.appendChild(vidIFrame);
                        msgHolder.appendChild(IFrameHolder);

                        // Add play in popup button
                        const fab = document.createElement('button');
                        fab.classList.add('mdc-fab', 'mdc-fab--mini', 'play-popup-btn');
                        const fabRipple = document.createElement('div');
                        fabRipple.classList.add('mdc-fab__ripple');
                        const fabIcon = document.createElement('span');
                        fabIcon.classList.add('mdc-fab__icon', 'material-icons');
                        fabIcon.innerHTML = 'picture_in_picture';
                        // Add them all to the fab
                        fab.appendChild(fabRipple);
                        fab.appendChild(fabIcon);
                        // Set click listener
                        fab.onclick = queuePopup;

                        msgHolder.appendChild(fab);
                        // Init MDC component
                        new mdc.ripple.MDCRipple(fab);

                        function queuePopup() {
                            playVideo(vidID);
                        }

                        break;
                    }
                }
            }
            msgHolder.style.display = 'table';
            if (it.val().Author === userUUID) msgHolder.classList.add('from-user');
            else msgHolder.classList.add('from-remote');
            msgHolder.appendChild(msgText);
            msgArea.appendChild(msgHolder);
            addedCount++;
        })
        // Check if there are any messages, if not show a no message text
        if (msgArea.childElementCount === 0) {
            const msgText = document.createElement('p');
            msgText.innerHTML = 'No messages'
            msgText.style.textAlign = 'center';
            msgText.style.marginTop = '10px';
            msgText.id = 'no-msg-text';
            msgArea.appendChild(msgText);
        }
        // Then scroll to bottom with an animation if its not the first time messages are added
        scrollToBottom();
    }); // End async message listener
} // End refreshList

const messageTextbox = new window.mdc.textField.MDCTextField(document.getElementById('message-textbox'));

// Add groups to navigation bar
let first = true
function addNavBarItem(uuid) {
    // Holder
    const listItem = document.createElement('a');
    listItem.classList.add('mdc-list-item');
    if (first) {
        selectedGroup = uuid;
        listItem.classList.add('mdc-list-item--activated');
        first = false;
    }
    listItem.onclick = function () {
        selectedGroup = uuid;
        msgArea.innerHTML = '';
        refreshList();
    };
    // MDC Ripple span
    const rippleSpan = document.createElement('span');
    rippleSpan.classList.add('mdc-list-item__ripple');
    // Icon
    const listGraphic = document.createElement('i');
    listGraphic.classList.add('material-icons', 'mdc-list-item__graphic');
    listGraphic.setAttribute("aria-hidden", "true");
    listGraphic.innerHTML = 'group';
    // Group name span
    const spanGrpName = document.createElement('span');
    spanGrpName.classList.add('mdc-list-item__text');
    spanGrpName.innerHTML = groupData[uuid].grpName;
    // Then, add them all to the listItem holder
    listItem.appendChild(rippleSpan);
    listItem.appendChild(listGraphic);
    listItem.appendChild(spanGrpName);
    // Finally add the holder to the parent container
    document.querySelector('nav.mdc-list').appendChild(listItem);
    // Also need to init materialRipple
    new mdc.ripple.MDCRipple(listItem);
} // End addNewNavGrp

let groupData;
let inviteList = {};

// ====================
function init() {
    // Init text box
    new mdc.textField.MDCTextField(document.getElementById('message-textbox'));
    if(localStorage.getItem('inviteData') !== null) {
        inviteList = JSON.parse(localStorage.getItem('inviteData'));
        Object.keys(inviteList).forEach(function(grpCode) {
            database.ref('encryptedAESKeys/' + grpCode).on('value', function(snapshot) {
                if (snapshot.val() !== null) {
                    if (snapshot.val().EncryptedAES !== 'rej') decryptAccept(snapshot, grpCode);
                    else showSnackbarErr('Your request to join "' + snapshot.val().GrpName + '" was rejected');

                    deletePendingInvite(snapshot.val().GrpUUID);
                }
            });
        })
    }
    if (groupData !== undefined) {
        Object.keys(groupData).forEach(function(k){
            addNavBarItem(k);
        });
    }
    if (selectedGroup.length === 0) {
        document.querySelector('.add-first-grp').style.display = 'block';
    }
    if (selectedGroup.length !== 0) refreshList();
    else progressBar.style.display = 'none';
    // initAutoresize();
}
// init(); This func will be called by the login manager
// ====================

function init_pwdField() { // Check if a hash is already present
    if (localStorage.getItem('pwdHash') === null) document.getElementById('login-box').style.display = 'none';
    else document.getElementById('create_pwd').style.display = 'none';
}
init_pwdField();
// --------------------

// Account creation
function c_acct() {
    // Check validity of password
    const enteredPwd = new mdc.textField.MDCTextField(document.getElementById('newPwdField')).value;
    if (enteredPwd === undefined || enteredPwd.length < 8) {
        showSnackbarErr('Length of password must be longer than 8');
        return;
    }
    password = enteredPwd;
    // Hash PW with cost 11 and store it
    showLoginPgMsg('Hashing password');
    localStorage.setItem('pwdHash',
        bcrypt.hashSync(enteredPwd, 11));
    b_init();
}

// --------------------

function showLoginPgMsg(msg) {
    document.getElementById('login-msg').innerHTML = msg;
}

// --------------------

let password;

// Login/grpData decryption
function c_login() {
    showLoginPgMsg('Verifying');
    const enteredPwd = new mdc.textField.MDCTextField(document.getElementById('pwdField')).value;
    password = enteredPwd;
    if (bcrypt.compareSync(enteredPwd, localStorage.getItem('pwdHash'))) {
        showLoginPgMsg('Decrypting data');
        if(localStorage.getItem('grpData') === null) {
            groupData = {};
        } // Empty JSON object
        else {
            try {
                groupData = JSON.parse(CryptoJS.AES.decrypt(localStorage.getItem('grpData'), enteredPwd).toString(CryptoJS.enc.Utf8));
            }
            catch (e) {
                showLoginPgMsg('Decryption error. Group data might be corrupt.');
            }
        }
        b_init();
    }
    else {
        showLoginPgMsg('Incorrect password. Please try again')
        // Wrong pwd
        showSnackbarErr('Incorrect password, try again');
    }
}

// Bootstrap init
function b_init() {
    if (groupData === undefined) groupData = {};
    init(); // Init DB and msgList stuff
    // Show navbar elements
    document.querySelector('.material-icons.mdc-top-app-bar__navigation-icon.mdc-icon-button').style.display = 'block';
    const loginOverlay = document.querySelector('.login-overlay');
    loginOverlay.style.opacity = '0';
    loginOverlay.style.pointerEvents = 'none';
}

// --------------------
function toggleVisibility(obj, toggleBtn) {
    if (obj.type === 'password') {
        toggleBtn.querySelector('.mdc-fab__icon.material-icons').innerHTML = 'visibility_off';
        obj.type = 'text';
    }
    else {
        toggleBtn.querySelector('.mdc-fab__icon.material-icons').innerHTML = 'visibility';
        obj.type = 'password';
    }
}

// ====================

// Main function to send messages
function sendMsg() {
    if (selectedGroup.length === 0) {
        showSnackbarErr('Create or join a group first');
        return;
    }
    const msg = messageTextbox.value.trim(); // trim removes spaces before and aft text
    // Check for empty message
    if (msg.length === 0) {
        showSnackbarErr('Your message is empty');
        return;
    }
    else if (msg === '!!!zeruiMode!!!') {
        changeZeruiMode();
        return;
    }

    // If no problems were found, send the msg
    const key = database.ref('messages/' + selectedGroup).push().getKey();
    database.ref('messages/' + selectedGroup + '/' + key).set({
        Content: encryptMessage(msg),
        Author: userUUID
    });
    // After sending clear message box
    messageTextbox.value = '';
} // End sendMsg

// Register an event listener that calls the sendMsg function when the enter key is pressed
document.querySelector('#message-textbox textarea').addEventListener("keyup", function(event) {
    // Number 13 is the "Enter" key on the keyboard
    if (event.keyCode === 13) {
        // Cancel the default action, if needed
        event.preventDefault();
        // Trigger the button element with a click
        sendMsg();
    }
});

// Function for updating localStorage
function updateLocalGrpData() {
    localStorage.setItem('grpData', CryptoJS.AES.encrypt(JSON.stringify(groupData), password).toString());
} // End updateLocalGrpData

// ===================
_arrayBufferToBase64 = function (u8) {
    return btoa(String.fromCharCode.apply(null, u8));
}

_base64ToArrayBuffer = function (str) {
    return atob(str).split('').map(function (c) { return c.charCodeAt(0); });
}
// ===================

// ===================
async function addNewGrp() {
    if (document.querySelector('#join-group').classList.contains('hidden') &&
        !document.querySelector('#create-group').classList.contains('hidden')) {

        // Get group name
        let grpName = new mdc.textField.MDCTextField(document.getElementById('create-grp-name')).value.trim();
        if (grpName.length === 0) grpName = 'No Name';
        // Generate key and IV
        const key = secureRandom(32);
        const iv = secureRandom(16);
        // Generate new UUID
        const newGrpUUID = generateRandomUUID();
        // Then, update variable and localstorage
        groupData[newGrpUUID] = {
            grpName: grpName,
            AESKey: _arrayBufferToBase64(key),
            AESIV: _arrayBufferToBase64(iv),
        };
        updateLocalGrpData();
        addNavBarItem(newGrpUUID);
    }
    else if (!document.querySelector('#join-group').classList.contains('hidden') &&
        document.querySelector('#create-group').classList.contains('hidden')) {
        const grpCode = new mdc.textField.MDCTextField(document.getElementById('join-grp-code')).value;
        if (grpCode.length !== 6) { // Not a number
            showSnackbarErr('Invalid invite code');
            return;
        }

        database.ref('invites/' + grpCode).once('value').then(function(snapshot) {
            if (snapshot.val() === null) {
                showSnackbarErr('Invite code not found');
            }
            else {
                if (snapshot.val().GrpUUID in groupData) { // Check to see if user is already a participant
                    showSnackbarErr('You are already a participant');
                    return;
                }

                // Get RSA keypair
                const keyGen = new JSEncrypt();

                // Send request
                const key = database.ref('messages/' + selectedGroup).push().getKey();
                database.ref('messages/' + snapshot.val().GrpUUID + '/' + key).set({
                    Content: keyGen.getPublicKey() + ',' + grpCode,
                    Author: 'specialGrpRequest'
                });

                database.ref('invites/' + grpCode).remove();
                inviteList[grpCode] = {
                    private: keyGen.getPrivateKey()
                };
                updateInviteList();

                showSnackbarErr('Request to join group sent.');

                // Listen for result
                database.ref('encryptedAESKeys/' + grpCode).on('value', function(snapshot) {
                    if (snapshot.val() !== null) {
                        if (snapshot.val().EncryptedAES !== 'rej') decryptAccept(snapshot, grpCode);
                        else showSnackbarErr('Your request to join "' + snapshot.val().GrpName + '" was rejected');

                        deletePendingInvite(snapshot.val().GrpUUID);
                    }
                });
            }
        });
    }
} // End addNewGrp

// ===============
// Smaller helper functions
function showSnackbarErr(msg) {
    document.querySelector('.mdc-snackbar #snackbar-text').innerHTML = msg;
    snackbar.open();
}
// ---------------
function updateInviteList() {
    localStorage.setItem('inviteData', JSON.stringify(inviteList));
}
// ---------------
function decryptAccept(snapshot, grpCode) {
    const decrypt = new JSEncrypt();
    decrypt.setPrivateKey(inviteList[grpCode].private);
    deletePendingInvite(grpCode);
    const AESKeys = decrypt.decrypt(snapshot.val().EncryptedAES).split(',');
    addNewGroup(AESKeys[0], AESKeys[1], snapshot.val().GrpName, snapshot.val().GrpUUID);
    showSnackbarErr('You request to join"' + snapshot.val().GrpName + '" was accepted')
}
// ---------------
function deletePendingInvite(grpCode) {
    delete inviteList[grpCode];
    updateInviteList();
    database.ref('encryptedAESKeys/' + grpCode).off();
}
// ---------------
function addNewGroup(AESKey, AESIV, groupName, grpUUID) {
    groupData[grpUUID] = {
        grpName: groupName,
        AESKey: AESKey,
        AESIV: AESIV,
    };
    updateLocalGrpData();
    addNavBarItem(grpUUID)
}
// ===============

// Get an invite code
// ==================
function getGrpInviteCode() {
    if (selectedGroup.length === 0) {
        // There are no groups (first run)
        showSnackbarErr('Create or join a group first');
        return;
    }
    // Generate random code
    let dt = new Date().getTime();
    const grpCode = 'xxxxxx'.replace(/[xy]/g, function(c) {
        const r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt / 16);
        return (c==='x' ? r :(r&0x3|0x8)).toString(16);
    });
    document.querySelector('.grpInviteCode').innerHTML = grpCode;
    new window.mdc.dialog.MDCDialog(document.querySelector('#get-grp-code')).open();
    database.ref('invites/' + grpCode).set({
        GrpUUID: selectedGroup
    });
}

// Popup YT player
function playVideo(videoID) {
    const dragHandle = document.querySelector('#popup-YT #popup-drag');
    const mainHolder = document.querySelector('#popup-YT');
    document.querySelector('#popup-YT iframe').src = 'https://www.youtube-nocookie.com/embed/' + videoID + '?autoplay=1';
    mainHolder.style.display = 'block';
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    dragHandle.onmousedown = dragMouseDown;
    document.querySelector('#popup-YT #popup-drag .close-btn').onclick = closePopup;

    function closePopup() {
        document.querySelector('#popup-YT iframe').src = null;
        mainHolder.style.display = 'none';
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        mainHolder.style.top = (mainHolder.offsetTop - pos2) + "px";
        mainHolder.style.left = (mainHolder.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
    isPlaying = true;
}

// ============================
// Textbox autoresize
function initAutoresize() {
    const tex = document.querySelector('#message-textbox textarea');
    tex.addEventListener('keydown', resize);
    function resize() {
        setTimeout(function() {
            tex.style.height = 'auto'; // Needed when you remove content so we reduce the height
            tex.style.height = tex.scrollHeight + 'px';
        }, 0);
    }
}