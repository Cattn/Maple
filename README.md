<p align="center">
    <img src="https://raw.githubusercontent.com/Cattn/Maple/d3edeef4f7bce80170f58220a677d1fecc7c40f2/resources/maple_main_icon.png" width="128" alt="Maple Icon"/>
</p>

<h3 align="center">
    <strong>Maple</strong>
</h3>

<p align="center">
    <a href="https://maple.music/" target="_blank">stable</a> · <a href="https://beta.cattn.dev/" target="_blank">beta</a>
</p>

> Need Help? Join our [Development Server](https://discord.gg/Wxrp73HVj4)

<p align="center">
    Maple is a music library and organization tool. It allows you to upload your music library and watch it be organized into albums, artists, playlists, and more! You are given robust controls to play and organize your music. In the future, it will include optional social and stat-tracking features.
</p>

## How to use?

- Head to settings
- Upload your music library
- That's it!

## How do Accounts work?

Accounts give you access to social, and other online features! Want to know what your friends are listening to? Share your music to your discord server? Have access to a public API to get your recent listening history? All of that & More is unlocked when you make an account! No email required + free!.

## Q&As

Will my library be sent to anyone?

- No! Your library is completely managed on-device using the Origin Private File System (OPFS). If you enable developer controls in settings, you can interface with this OPFS in a rudimentary terminal-style environment!

Help! I have \_\_\_ Bug!

- You can report any bugs in the Issues tab [here](https://github.com/Maple-Development/Maple/issues)!
  > Please note, this site is still early in development. Many features/bugs are known and are actively being worked on. Check our discord [here](https://discord.gg/Wxrp73HVj4) for more information.

How do the account features work?

- By creating an account, and logging in, you unlock the ability to share your currently playing music with a community webhook instance or your own personal webhook. You also can add friends, transfer your library to other devices, and more! All person to person transfers are peer2peer based.

What data is saved on the server?

- Your username, id, hashed & salted password\*, pfp, and then friendship status with other users. More information may be stored temporarily, or for other features. Please see our Privacy Policy for more information.
  > \*your plaintext password will NEVER be avalible to anyone, even those with access to our servers.

If you have any other questions, feel free to DM `cattn.` on discord, or email me @ `Logan@cattn.dev`

## API Documentation

> API Link: https://api.maple.music/

### ``GET`` - ``/public/get/user/:username``
Returns a user based on the given username.

Request Example:
```js
const response = await fetch(`${this.SERVER}/public/get/user/${username}`, {
    credentials: 'include',
    method: 'GET'
});
const data = await response.json();
```

Response:
```
{
    id: id,
    username: username,
    name?: name,
}
```

### ``GET`` - ``/public/get/user/id/:id``
Returns a user based on the given id.

Request Example:
```js
const response = await fetch(`${this.SERVER}/public/get/user/id/${id}`, {
    method: 'GET'
});
const data = await response.json();
```

Response:
```
{
    id: id,
    username: username,
    name?: name,
    nowPlaying?: {
        title: title,
        artist: artist,
        album: album
    }
}
```

### ``GET`` - ``/public/get/pfp/:id``
Returns a profile picture based on the given id.

Request Example:
```js
const response = await fetch(`${this.SERVER}/public/get/pfp/${id}`, {
    method: 'GET'
});
const data = await response;
```

Response:
```
File Object
```

### ``POST`` - ``/user/friends/add/:id``
Add a given user to your friends list by ID.

REQUIRED: ``Login Token``*

Request Example:
```js
const response = await fetch(`${this.SERVER}/user/friends/add/${id}`, {
    credentials: 'include',
    method: 'POST'
});
const data = await response.json();
```

Response: ``200``
```
{ message: 'Request sent successfully' }
```

Response: ``500``
```
{ error: 'Error adding friend' }
```

### * How do I get login token?
> Typically you can only get a login token by logging in on our site, however if you extract this cookie you can use it from another site to login.
## What's the inspiration behind it?

Maple was inspired by various experiences, such as being on a plane without internet. While I had my music with me, I found local tools like Windows Media Player lacking. This project not only aims to solve that issue but also serves as a learning experience for me.

## Wondering how we use your data?

You can view our privacy policy [here](https://maple.music/privacy)!

## Credits

### Lead & Only Developer

- Cattn

### Logos & Branding

- Nailington
