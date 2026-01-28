// ======================================
// GROUP CHAT SYSTEM (IMPROVED)
// ======================================

const groupdb = new FirebaseAPI(
  "https://thgrade-17fcd-default-rtdb.firebaseio.com/"
)

let currentGroupId = null

// ======================================
// AUTH
// ======================================
function checkAuth() {
  const token = localStorage.getItem("authToken")
  const username = localStorage.getItem("username")
  if (!token || !username) {
    window.location.href = "index.html"
  }
}

// ======================================
// HELPERS
// ======================================
function escapeHtml(text) {
  if (!text) return ""
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function normalizeGroupName(name) {
  return name.trim().replace(/\s+/g, " ")
}

function parseMembers(input) {
  return [...new Set(
    input
      .split(",")
      .map(u => u.trim())
      .filter(Boolean)
  )]
}

async function userExists(username) {
  return !!(await groupdb.get(`/users/${username}`))
}

function generateGroupId(name) {
  return sha256(name.toLowerCase()).slice(0, 16)
}

// ======================================
// LOAD GROUPS (ONLY MEMBER OF)
// ======================================
async function loadGroups() {
  const username = localStorage.getItem("username")
  const groups = await groupdb.get("/groups")

  const list = document.getElementById("groupsList")
  list.innerHTML = ""

  if (!groups) return

  Object.entries(groups).forEach(([groupId, group]) => {
    if (!group.members?.[username]) return

    const item = document.createElement("div")
    item.className = "group-item"
    item.textContent = group.name

    item.onclick = () => {
      document
        .querySelectorAll(".group-item")
        .forEach(i => i.classList.remove("active"))

      item.classList.add("active")
      enterGroup(groupId)
    }

    list.appendChild(item)
  })
}

// ======================================
// ENTER GROUP
// ======================================
async function enterGroup(groupId) {
  const username = localStorage.getItem("username")
  const group = await groupdb.get(`/groups/${groupId}`)

  if (!group?.members?.[username]) {
    alert("Access denied")
    return
  }

  currentGroupId = groupId

  document.getElementById("groupChat").classList.remove("hidden")
  document.getElementById("groupChatHeader").innerHTML = `
    <h2>${escapeHtml(group.name)}</h2>
    ${group.creator === username
      ? `<button id="inviteBtn" class="btn-secondary">Invite</button>`
      : ""}
  `

  if (group.creator === username) {
    document.getElementById("inviteBtn").onclick = () =>
      inviteUser(groupId)
  }

  loadMessages(groupId)
}

// ======================================
// LOAD MESSAGES
// ======================================
async function loadMessages(groupId) {
  const messages = await groupdb.get(`/groups/${groupId}/messages`)
  const container = document.getElementById("groupMessages")
  container.innerHTML = ""

  if (!messages) return

  Object.values(messages)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach(msg => {
      const div = document.createElement("div")
      div.className = "message received"

      div.innerHTML = `
        <strong>${escapeHtml(msg.author)}</strong>:
        ${escapeHtml(msg.text)}
        <div class="message-time">
          ${new Date(msg.createdAt).toLocaleTimeString()}
        </div>
      `

      container.appendChild(div)
    })

  container.scrollTop = container.scrollHeight
}

// ======================================
// CREATE GROUP MODAL
// ======================================
document.getElementById("createGroupBtn").onclick = () => {
  document.getElementById("createGroupModal").classList.remove("hidden")
}

document.getElementById("closeGroupModal").onclick = () => {
  document.getElementById("createGroupModal").classList.add("hidden")
}

// ======================================
// CREATE GROUP (SAFE + VALIDATED)
// ======================================
document
  .getElementById("confirmCreateGroup")
  .addEventListener("click", async () => {
    const rawName = document.getElementById("groupName").value
    const privacy = document.getElementById("groupPrivacy").value
    const memberInput = document.getElementById("groupMembers").value
    const creator = localStorage.getItem("username")

    const name = normalizeGroupName(rawName)
    if (!name) return alert("Group name required")

    const groupId = generateGroupId(name)

    if (await groupdb.get(`/groups/${groupId}`)) {
      return alert("Group already exists")
    }

    const members = { [creator]: true }
    const invited = parseMembers(memberInput)

    for (const user of invited) {
      if (user === creator) continue
      if (await userExists(user)) {
        members[user] = true
      }
    }

    await groupdb.set(`/groups/${groupId}`, {
      name,
      creator,
      privacy,
      createdAt: new Date().toISOString(),
      members,
      messages: {}
    })

    document.getElementById("groupName").value = ""
    document.getElementById("groupMembers").value = ""
    document.getElementById("createGroupModal").classList.add("hidden")

    loadGroups()
  })

// ======================================
// INVITE USER (CREATOR ONLY)
// ======================================
async function inviteUser(groupId) {
  const inviter = localStorage.getItem("username")
  const username = prompt("Username to invite:")

  if (!username) return
  if (!(await userExists(username))) {
    return alert("User does not exist")
  }

  const group = await groupdb.get(`/groups/${groupId}`)
  if (group.creator !== inviter) {
    return alert("Only the creator can invite users")
  }

  await groupdb.set(
    `/groups/${groupId}/members/${username}`,
    true
  )

  alert(`${username} added`)
}

// ======================================
// SEND MESSAGE
// ======================================
document
  .getElementById("sendGroupMessageBtn")
  .addEventListener("click", async () => {
    if (!currentGroupId) {
      return alert("Select a group first")
    }

    const input = document.getElementById("groupMessageText")
    const text = input.value.trim()
    if (!text) return

    const username = localStorage.getItem("username")

    await groupdb.push(
      `/groups/${currentGroupId}/messages`,
      {
        author: username,
        text,
        createdAt: new Date().toISOString()
      }
    )

    input.value = ""
    loadMessages(currentGroupId)
  })

// ======================================
// AUTO REFRESH
// ======================================
setInterval(() => {
  if (currentGroupId) loadMessages(currentGroupId)
}, 3000)

// ======================================
// INIT
// ======================================
document.addEventListener("DOMContentLoaded", () => {
  checkAuth()
  loadGroups()
})
