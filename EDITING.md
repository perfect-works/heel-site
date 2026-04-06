# Editing Guide

## Updating user folder contents

All member data lives in the `MEMBERS` object in `index.html`. Each member is one line.

| Member | Line |
|--------|------|
| adharsh | 224 |
| tayla | 225 |
| nick | 226 |
| andres | 227 |

### Fields

Each member entry can have the following fields:

```javascript
'name': {
    instrument: 'guitar / vocals',  // shown as fallback if profile is null
    profile: 'bio text here',       // shown by: cat profile.txt / profile
                                    // set to null to show instrument line instead
    gear: 'line 1\nline 2',         // shown by: cat gear.txt / gear
                                    // omit field entirely if member has no gear
    data: 'line 1\nline 2',         // shown by: cat data.txt / data
                                    // omit field entirely if member has no data
    photo: 'images/users/name/filename.png',  // actual file path on disk
    photoName: 'filename.png',                // internal name; always displayed as photo.jpg
}
```

### Updating a photo

1. Drop the new image into `images/users/<name>/`
2. Update the `photo` path and `photoName` value on the member's line

### Adding a profile / gear / data to a member who doesn't have one

1. Add the field to the member's entry on their line in `index.html`
2. That's it — `cat profile.txt`, `cat gear.txt`, and `cat data.txt` commands already check for these fields and render automatically. The file also appears in both the terminal directory listing and the Welt Explorer window.
