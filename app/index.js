import { DrawableCanvasElement } from "@snakemode/snake-canvas";
import Ably from 'ably/promises';

async function updateActiveCount(channel) {
    const members = await channel.presence.get();
    document.getElementById("memberCount").innerHTML = members.length;
}

async function joinBoard(boardId) {
    const canvas = new DrawableCanvasElement("draw");
    canvas.setSize(1024, 720);
    canvas.registerPaletteElements("paletteId");

    const ably = new Ably.Realtime.Promise({ authUrl: '/api/createTokenRequest' });
    const channel = ably.channels.get(`whiteboard-${boardId}`);

    await channel.subscribe((message) => {
        if (message.name === "setBackground") {
            canvas.paintCanvas.setAttribute('data-background', message.data);
            return;
        }

        if (ably.connection.id != message.connectionId) {
            canvas.addMarks(message.data);
        }
    });

    canvas.onNotification((evt) => {
        channel.publish({ name: "drawing", data: evt });
    });

    channel.presence.subscribe('enter', async () => { updateActiveCount(channel); });
    channel.presence.subscribe('leave', async () => { updateActiveCount(channel); });
    channel.presence.enter();

    return { canvas, channel };
};

(async function () {
    const urlParams = new URLSearchParams(location.search);
    const boardName = urlParams.get("boardName");

    if (!boardName) {
        document.getElementById("boardName").value = "1234";
        document.getElementById("join").classList.remove("hidden");
        return;
    }

    const state = await joinBoard(boardName);
    document.getElementById("activeBoard").classList.remove("hidden");

    const backgrounds = document.getElementById("backgrounds");
    for (let bg of backgrounds.children) {
        bg.addEventListener('click', (event) => {
            state.channel.publish({ name: "setBackground", data: event.target.dataset["bg"] });
        });
    }
})();