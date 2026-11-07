async function initNavNotifications() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const badgeChannels = document.getElementById("badge-msg-channels");
  const badgeDMs = document.getElementById("badge-msg-dms");

  const unreadChannels = Number(localStorage.getItem("unread_channels_count") || 0);
  const unreadDMs = Number(localStorage.getItem("unread_dms_count") || 0);

  updateBadge(badgeChannels, unreadChannels);
  updateBadge(badgeDMs, unreadDMs);

  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage === "messages.html" && badgeChannels) {
    localStorage.setItem("unread_channels_count", "0");
    updateBadge(badgeChannels, 0);
  }
  if (currentPage === "message_prive.html" && badgeDMs) {
    localStorage.setItem("unread_dms_count", "0");
    updateBadge(badgeDMs, 0);
  }

  supabaseClient
    .channel("global_aside_notifications")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      if (currentPage !== "messages.html" && payload.new.created_by !== user.id) {
        let count = Number(localStorage.getItem("unread_channels_count") || 0) + 1;
        localStorage.setItem("unread_channels_count", count.toString());
        updateBadge(badgeChannels, count);
      }
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
      if (payload.new.receiver_id === user.id && currentPage !== "message_prive.html") {
        let count = Number(localStorage.getItem("unread_dms_count") || 0) + 1;
        localStorage.setItem("unread_dms_count", count.toString());
        updateBadge(badgeDMs, count);
      }
    })
    .subscribe();
}

function updateBadge(badgeEl, count) {
  if (!badgeEl) return;
  if (count > 0) {
    badgeEl.textContent = count > 99 ? "99+" : count;
    badgeEl.style.display = "flex";
  } else {
    badgeEl.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", initNavNotifications);
