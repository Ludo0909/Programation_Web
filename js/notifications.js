let realtimeNotifChannel = null;

async function initNavNotifications() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !session.user) return;

  const currentUserId = session.user.id;
  const badgeChannels = document.getElementById("badge-msg-channels");
  const badgeDMs = document.getElementById("badge-msg-dms");

  const unreadChannels = Number(localStorage.getItem("unread_channels_count") || 0);
  const unreadDMs = Number(localStorage.getItem("unread_dms_count") || 0);

  updateBadge(badgeChannels, unreadChannels);
  updateBadge(badgeDMs, unreadDMs);

  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage === "messages.html") {
    localStorage.setItem("unread_channels_count", "0");
    updateBadge(badgeChannels, 0);
  }
  if (currentPage === "message_prive.html") {
    localStorage.setItem("unread_dms_count", "0");
    updateBadge(badgeDMs, 0);
  }

  if (realtimeNotifChannel) {
    supabaseClient.removeChannel(realtimeNotifChannel);
  }

  realtimeNotifChannel = supabaseClient
    .channel("notifications-global")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        if (currentPage !== "messages.html" && payload.new.created_by !== currentUserId) {
          let count = Number(localStorage.getItem("unread_channels_count") || 0) + 1;
          localStorage.setItem("unread_channels_count", count.toString());
          updateBadge(badgeChannels, count);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages" },
      (payload) => {
        if (currentPage !== "message_prive.html" && payload.new.receiver_id === currentUserId) {
          let count = Number(localStorage.getItem("unread_dms_count") || 0) + 1;
          localStorage.setItem("unread_dms_count", count.toString());
          updateBadge(badgeDMs, count);
        }
      }
    )
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