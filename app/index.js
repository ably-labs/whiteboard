import { DrawableCanvasElement } from "@snakemode/snake-canvas";
import Ably from 'ably/promises';

async function updateActiveCount(channel) {
    const members = await channel.presence.get();
    document.getElementById("memberCount").innerHTML = members.length;
   // console.log(members);
     members.forEach(function(val, i){
        console.log(val.connectionId);
        const newDiv = document.createElement("div");
        newDiv.innerHTML = val.connectionId;
        newDiv.id = val.connectionId;
        newDiv.className = "cursor";
        document.getElementById("cursors").appendChild(newDiv);
     })
}

async function joinBoard(boardId) {
    const canvas = new DrawableCanvasElement("draw");
    canvas.setSize(1024, 720);
    canvas.registerPaletteElements("paletteId");

    const ably = new Ably.Realtime.Promise({ authUrl: '/api/createTokenRequest' });
    const channel = ably.channels.get(`whiteboard-${boardId}`);
    const mouseChannel = ably.channels.get(`whiteboard-mouse-${boardId}`);

    await channel.subscribe((message) => {
        if (message.name === "setBackground") {
            canvas.paintCanvas.setAttribute('data-background', message.data);
            return;
        }

        if (ably.connection.id != message.connectionId) {
            canvas.addMarks(message.data);
        }
    });

    await mouseChannel.subscribe((message) => {
        console.log(message.connectionId);
        let cursor = document.getElementById(message.connectionId);
        console.log(message.data);
        cursor.style.transform = `translate(${message.data[0]}px, ${message.data[1]}px)`;
    
    })

    canvas.onNotification((evt) => {
        channel.publish({ name: "drawing", data: evt });
    });

    channel.presence.subscribe('enter', async () => { updateActiveCount(channel); });
    channel.presence.subscribe('leave', async () => { updateActiveCount(channel); });
    channel.presence.enter();

    return { canvas, channel, mouseChannel };
};

async function getMousePos(e) {
    return { x:e.clientX, y:e.clientY };
}

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

    document.onmousemove = async function(e) {
        let mousecoords = await getMousePos(e);
        state.mouseChannel.publish({ name: "mouse", data: [mousecoords.x, mousecoords.y] });
    };
    
})();