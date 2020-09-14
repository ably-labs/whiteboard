# Interacive, multi-user whiteboard

https://wonderful-grass-089d6bd03.azurestaticapps.net


This demo will walk throught building a digital whiteboard, using HTML, JavaScript, and Ably Realtime messages. You'll have probably seen digital whiteboards before - they're often integrated into workplace collaboration software, and they can be tricky to get right.

# What are we going to build?

We're going to:

- Build a static web application with a HTML5 Canvas
- Add a single API to integrate with Ably token authentication
- Use a Drawable Canvas library to allow people to draw with their mouse and fingers
- Hook up the Canvas to Ably so that when a user draws, messages are sent to other people viewing the board 
- Host our application on Azure Static Web Apps

# Dependencies

- An Ably API key
- An Azure Account for hosting on production
- Node 12 (LTS)

# Configuring Ably

We're going to need to configure our system for local development, and to do that we need to

- Install the azure-functions-core-tools
- Add our Ably API key to a configuration file
- Configure a function to provide the Ably SDK with `token authentication` credentials

## Ably Channels for pub/sub

The app uses [Ably](https://www.ably.io/) for [pub/sub messaging](https://www.ably.io/documentation/core-features/pubsub) between the players. Ably is an enterprise-ready pub/sub messaging platform that makes it easy to design, ship, and scale critical realtime functionality directly to your end-users.

[Ably Channels](https://www.ably.io/channels) are multicast (many publishers can publish to many subscribers) and we can use them to build apps.

## Ably channels and API keys

In order to run this app, you will need an Ably API key. If you are not already signed up, you can [sign up now for a free Ably account](https://www.ably.io/signup). Once you have an Ably account:

1. Log into your app dashboard.
2. Under **“Your apps”**, click on **“Manage app”** for any app you wish to use for this tutorial, or create a new one with the “Create New App” button.
3. Click on the **“API Keys”** tab.
4. Copy the secret **“API Key”** value from your Root key, we will use this later when we build our app.

This app is going to use [Ably Channels](https://www.ably.io/channels) and [Token Authentication](https://www.ably.io/documentation/rest/authentication/#token-authentication).

## Local dev pre-requirements

We'll use Azure functions for hosting our API, so you'll need the Azure functions core tools.

```bash
npm install -g azure-functions-core-tools
```

You'll also need to set your API key for local dev:

```bash
cd api
func settings add ABLY_API_KEY Your-Ably-Api-Key
```
Running this command will encrypt your API key into the file `/api/local.settings.json`.
You don't need to check it in to source control, and even if you do, it won't be usable on another machine.

## How authentication with Ably works

Azure static web apps don't run traditional "server side code", but if you include a directory with some Azure functions in your application, Azures deployment engine will automatically create and manage Azure functions for you, that you can call from your static application.

For local development, we'll just use the Azure functions SDK to replicate this, but for production, we can use static files (or files created by a static site generator of your choice) and Azure will serve them for us.

## In the Azure function

We have a folder called API which contains an Azure functions JavaScript API. There's a bunch of files created by default (package.json, host.json etc) that you don't really need to worry about, and are created by the Functions SDK. If you wanted to expand the API, you would use npm install and the package.json file to manage dependencies for any addtional functions.

There's a directory `api/createTokenRequest` - this is where all our "server side" code lives.

Inside it, there are two files - `index.js` and `function.json`. The function.json file is the Functions binding code that the Azure portal uses for configuration, it's generated by the SDK and you don't need to pay attention to it. Our Ably code is inside the `index.js` file.

```js
const Ably = require('ably/promises');

module.exports = async function (context, req) {
    const client = new Ably.Realtime(process.env.ABLY_API_KEY);
    const tokenRequestData = await client.auth.createTokenRequest({ clientId: 'ably-whiteboard' });
    context.res = { 
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tokenRequestData)
    };
};
```

By default, configures this API to be available on `https://azure-url/api/createTokenRequest`
We're going to provide this URL to the Ably SDK in our client to authenticate with Ably.

# The application

The entire application is made up of just three files

- `index.html` - the client side UI
- `index.js` - our JavaScript code
- `style.css` - our styles

In development, we're using [snowpack](http://snowpack.dev) as a hot-module-reload web server to run our code.

To run the code, you'll need to run the following to install our dependencies

```bash
npm install
cd api
npm install
```

And finally

```bash
npm run start
```

To start the application. When you start the app, your browser should open.

# Our UI

Let's start by taking a look at our `index.html` file.

First we have the standard HTML5 boilerplate and header, referencing some fonts, our styles and our index.js file as an ES Module

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <title>Example</title>
    <link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <script src="/index.js" type="module"></script>
</head>
```

Then we define our `picture frame` UI with some `CSS classes` that we'll use to add gradients

```html
<body>
    <div class="frame-top"></div>
    <div class="frame-left"></div>
    <div class="frame-right"></div>
    <div class="frame-bottom"></div>
```

followed by a HTML form that allows the user to specify the `boardName` they're trying to join

```html
    <section id="join" class="join hidden">
        <h1>Join a Whiteboard</h1>
        <form id="joinForm" class="join-form">
            <label for="boardName">Board Name: </label><input id="boardName" name="boardName" type="text" />
            <button id="joinBtn" type="submit">Join</button>
        </form>
    </section>
```

This form just posts back to exactly the same HTML file, and we'll detect the `query string parameter` the form post will add in our `JavaScript` code.

Next, we have our `activeBoard` - which contains a `canvas` element with the id `draw`, and a `ul` with a series of `colours`

```html
    <div id="activeBoard" class="hidden board-holder">
        <canvas id="draw"></canvas>
        <ul id="colours" class="colours">
            <li class="pen" id="green" data-color="green"></li>
            <li class="pen" id="blue" data-color="blue"></li>
            <li class="pen" id="red" data-color="red"></li>
            <li class="pen" id="black" data-color="black"></li>
            <li class="eraser" id="white" data-color="white"></li>
        </ul>
    </div>
</body>

</html>
```

Both the join form, and the activeBoard elements are hidden by default - we've added a `CSS class` called `hidden` that sets `display: none;`, and we'll unhide them as appropriate in our `JavaScript` code.

You could use a more comprehensive UI framework like `Vue.js` or `React` to build this UI, but for this small example a `hidden` class is fine :)

# Making our UI interactive

Now we're going to take a look at our `index.js` file to see the `JavaScript` that executes as we run our application.

First we're going to `import` some `node modules` using `ES Module import syntax`

```js
import { DrawableCanvasElement } from "@snakemode/snake-canvas";
import Ably from 'ably/promises';
```

We're importing both `DrawableCanvasElement` from the package `@snakemode/snake-canvas`, and the `Ably` SDK from `ably/promises`.

If you're eagle-eyed, you might be asking the question "but how can we import node modules in a HTML file! that doesn't work!" - we're using `snowpack` to allow us to do this. If you're interesting in how this works, read the notes at the bottom of this document.

Now we're going to define a function called `joinBoard` 

```js
async function joinBoard(boardId) {
    ...
};
```
And then the `JavaScript` that's going to run when we start executing our application - wrapped in an `async function` so we can use `async/await`.

This code does two things
- It checks the query string for a `boardName`
- It toggles the UI between displaying our `join board form` and our `activeBoard` by removing the `hidden` CSS class as appropriate.

So first we parse the `query string`

```js
(async function () {
    const urlParams = new URLSearchParams(location.search);
    const boardName = urlParams.get("boardName");
```

Then if we *do not find a boardname* we display the `join board form`

```js
    if (!boardName) {
        document.getElementById("boardName").value = "1234";
        document.getElementById("join").classList.remove("hidden");
        return;
    }
```
Otherwise, we call the `joinBoard` function with our `boardName`, and display the `board` after that call has completed.
```js
    const state = await joinBoard(boardName);
    document.getElementById("activeBoard").classList.remove("hidden");
})();
```

# Creating our board with `DrawableCanvasElement` 

Let's start by adding some code into our `joinBoard` element to use the `@snakemode/snake-canvas` package to make our `Canvas` element `draw` interactive.

```js
async function joinBoard(boardId) {
    const canvas = new DrawableCanvasElement("draw");
    canvas.setSize(1024, 768);
    canvas.registerPaletteElements("colours");
};
```

This function now does three things:
- It creates a new `canvas` variable, by creating an instance of `DrawableCanvasElement` passing the element id `draw` to it's constructor
- It calls `setSize` to size our canvas
- It calls `registerPaletteElements` passing the id of our list of `colours`.

`DrawableCanvasElement` is a library that we worked on for this project, and a few others and [its source is available on GitHub](https://github.com/snakemode/snake-canvas) along with being published as an `npm node module` as [@snakemode/snake-canvas](https://www.npmjs.com/package/@snakemode/snake-canvas).

The `DrawableCanvasElement` is responsible for adding the appropriate `click handlers` and `touch handlers` to our `canvas` element that make it interactive. When we pass it an `id` in it's `constructor call`, it'll find that element in the `DOM` and wire up these handlers. It contains some utility methods for accessing all the pixels in our canvas, for changing the colour of input, and most importantly for us it supports `batched callbacks` when a user interacts with it - allowing us to write code that responds to the user drawing things on the canvas.

We're going to provide it with a callback so we can capture the users input, and then send it to other clients using `Ably`.

When we call `canvas.registerPaletteElements("colours");` it tells the `DrawableCanvasElement` instance to add `click handlers` to each child element of the element id provided. What this means, in real terms is that given our `HTML UL` elements

```html
<ul id="colours" class="colours">
    <li class="pen" id="green" data-color="green"></li>
    <li class="pen" id="blue" data-color="blue"></li>
    <li class="pen" id="red" data-color="red"></li>
    <li class="pen" id="black" data-color="black"></li>
    <li class="eraser" id="white" data-color="white"></li>
</ul>
```

It'll add a click handler to each `li`.

This handler will call a function called `setActiveColour` on our canvas when clicked, and it'll look for a `data-attribute` called `data-color` (or `data-colour`!) to work out which colour to set. It supports any valid HTML colour.

At this point, if we open our application, we should be able to draw on our canvas, but obviously there's no way that the data is being sent between users.

# Tying it all together with Ably

We need to expand on this `joinBoard` function to add interactivity with Ably.

We're going to do a few things:
- We'll use a distinct Ably channel for each `boardName`
- We'll subscribe to messages on that channel
- We'll wire up a callback to publish messages to the channel when we draw something

Let's start with the same `canvas` creation code...

```js
async function joinBoard(boardId) {
    const canvas = new DrawableCanvasElement("draw");
    canvas.setSize(1024, 768);
    canvas.registerPaletteElements("colours");
```

Now we're going to create an `instance` of the `Ably Realtime` client - passing the `authUrl` of the `Azure Functions API` that we set up earlier to it's constructor. The `Ably SDK` will handle authentication for us now.

We then `get` a unique channel for our whiteboard based on the `boardId` passed to our function. This is just the value the user typed in the form when they clicked join. You don't need to create `Ably channels` ahead of time, so putting anything in here will just work.

```js
    const ably = new Ably.Realtime.Promise({ authUrl: '/api/createTokenRequest' });
    const channel = ably.channels.get(`whiteboard-${boardId}`);
```

Now, we're going to subscribe to messages that get published on that channel


```js
    await channel.subscribe((message) => {
        // more to come here
    });
```

Then we're going to provide the `DrawableCanvasElement` a callback by calling its `onNotification` function.
The `DrawableCanvasElement` emits a batch of events when a user draws on it - batched at 1000 events (literally pixels drawn), and everytime it reaches it's batch limit, or the user stops drawing, this callback will be invoked.

```js
    canvas.onNotification((evt) => {
        channel.publish({ name: "drawing", data: evt });
    });
    
    return { canvas, channel }; // We're returning our canvas and channel to use elsewhere
};
```

All we're doing in our callback, is calling our `Ably channel` `publish` function, passing in the event as it's `data` property.

What this means, is that when the user draws a bunch of pixels, that make up a line, the pixel data is going to be published on our `Ably channel`.

# What the Ably message contents looks like

The data that we send over our `channel` look like one of two things:

**Set Active Colour Messages**
```js
{ setActiveColour: this.activeColour }
```

**Pixel Coordinates**
```js
[123,456]
```
The data element itself is just an array of these messages, in the order they were emitted from the users canvas element.

# Subscribing to the Ably Messages

Our `DrawableCanvasElement` contains a function called `addMarks(events)` that we're going to wire up our subscription to.

We're going to expand our subscription code to look like this:

```js
    await channel.subscribe((message) => {
        if (ably.connection.id != message.connectionId) {
            canvas.addMarks(message.data);
        }
    });
```

All we're doing here is passing the entire contents of `message.data` - the array of events delivered over the `Ably message`, to the `addMarks` function on our `DrawableCanvasElement`. We're also making sure that we only process this message if it's been sent by another user - otherwise we'd end up processing the messages that we send and drawing on the canvas twice.

There's code inside the `DrawableCanvasElement` that knows how to iterate through this list of events, setting the colours and drawing lines on the canvas of anyone else currently viewing our whiteboard.

# Adding a user counter using Ably Presence

Ably offers a `Presence` feature, that you can turn on for your API key.

Presence sends additional messages when users enter and leave the `channel` and the JavaScript SDK can use these messages to keep track of users. (Once you've turned on presence in your Ably dashboard)[http://tempuri.org] we can add a little bit of code to our `joinBoard` function to process the Presence messages

```js
    channel.presence.subscribe('enter', async () => { updateActiveCount(channel); });
    channel.presence.subscribe('leave', async () => { updateActiveCount(channel); });
    channel.presence.enter();
```

As you can see here, we're setting up some callbacks by calling `channel.presence.subscribe` and calling a new function called `updateActiveCount`.

```js
async function updateActiveCount(channel) {
    const members = await channel.presence.get();
    document.getElementById("memberCount").innerHTML = members.length;
}
```

This function is using the `presence.get()` function in the Ably SDK, which keeps track of presence messages. Whilst it may look like it's directly querying Ably, actually, it's locally cached in memory, so it's just returning the latest list of `channel members` that it's already seen.

We've added a `<span>` into our markup with the `id` `memberCount` and we're just setting the `innerHTML` property to the number of `channel members` in the collection returned by the `get` call.

# Adding some fun backgrounds!

We've added some backgrounds to make our whiteboards a little bit more physical, and we can use Ably to sync the backgrounds between all the viewers of the board.

We're going to add another list of clickable elements int our markup

```html
<ul id="backgrounds" class="backgrounds">
    <li class="blank background" id="blank" data-bg="blank"></li>
    <li class="lined background" id="lined" data-bg="lined"></li>
    <li class="squared background" id="squared" data-bg="squared"></li>
    <li class="dotted background" id="dotted" data-bg="dotted"></li>
    <li class="graph background" id="graph" data-bg="graph"></li>
</ul>
```
When we click on one of these elements, we'll set the background of our canvas to the named background in the `bg` data attribute.

To do this, we're going to publish another message to our channel that looks like this:

```js
{ name: "setBackground", data: "dotted" });
```

Lets write that click handler code now, we'll just add it after we call `joinBoard`

```js
const backgrounds = document.getElementById("backgrounds");
for (let bg of backgrounds.children) {
    bg.addEventListener('click', (event) => {
        state.channel.publish({ name: "setBackground", data: event.target.dataset["bg"] });
    });
}
```

Here we're just adding a click handler to each of our elements, and sending an `Ably` message with the value from the `data-bg` attribute on our clicked element. We're giving our message the `name` `setBackground`, so let's add some code to handle this.

We're going to expand on `subscribe` call to handle this additional message:

```js
await channel.subscribe((message) => {
    if (message.name === "setBackground") {
        canvas.paintCanvas.setAttribute('data-background', message.data);
        return;
    }

    if (ably.connection.id != message.connectionId) {
        canvas.addMarks(message.data);
    }
});
```
We're just adding an `if` statement to the start and checking for our `setBackground` message. If we receive it, we're setting the `data-background` attribute on our HTML Canvas element, which we'll look for in our CSS to apply the background.

# And we're done!

That's it! Our final `index.js` file looks like this

```js
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
```

Multiple users can now join the same board, and as they draw, their marks are transmitted over `Ably channels` and appear in each others browers.

# Constraints

There are a few constraints in this example.

## No ownership of marks

This isn't a "workboard" like implementation where people own their marks, this is closer to cooperative `MSPaint`. This means users can happily delete parts of each others drawings - just like a real whiteboard!

## No storage

You'll only see the marks made on a board if you were viewing the board at the time. In a real implementation, it's likely that you would synchronise with an `API` that stores snapshots of the board in some kind of storage account, and you'd have the application restore from storage when a user joined the whiteboard.

## No resizing

Resizing HTML5 Canvas elements whilst retaining the contents for zoom and pan is a little more complicated than the scope of this piece allows. It's entirely possible, but it's unsupported in this example.

# Technical Notes - Snowpack

We're using `snowpack` as our development server and build pipeline.

> Snowpack is a modern, lightweight toolchain for faster web development. Traditional JavaScript build tools like webpack and Parcel need to rebuild  & rebundle entire chunks of your application every time you save a single file. This rebundling step introduces lag between hitting save on your > changes and seeing them reflected in the browser.
>
> Snowpack serves your application unbundled during development. Every file only needs to be built once and then is cached forever. When a file changes, Snowpack rebuilds that single file. There’s no time wasted re-bundling every change, just instant updates in the browser (made even faster via Hot-Module Replacement (HMR)). You can read more about this approach in our Snowpack 2.0 Release Post.
>
> Snowpack’s unbundled development still supports the same bundled builds that you’re used to for production. When you go to build your application for production, you can plug in your favorite bundler via an official Snowpack plugin for Webpack or Rollup (coming soon). With Snowpack already handling your build, there’s no complex bundler config required.

Snowpack allows us to:
- Reference NPM modules from our front-end
- Do bundle-less development with native ES Modules
- Hot-Reload while working on our UI
- Build for production with one command

If you take a look in `package.json` you'll notice there's a build task called `build:azure` - this is the task that the `Azure Static Web Applications` build process looks for, and it calls `npx snowpack build`.

This process will look at our web assets, and make sure it copies any `node modules` we're referencing in our HTML, and output the processed files into a directory called `build`.

The Azure pipeline looks for this as the location to publish our static site from, but if you want to see it running, you can run the same command on your computer.