export interface ContactRecord {
  handle: string
  name: string
  username: string
  background: string
  skin: string
  hair: string
  shirt: string
  hairstyle: 'long' | 'short' | 'curly'
}

const contacts: ContactRecord[] = [
  {
    handle: 'ct_7hk2',
    name: 'Maya Chen',
    username: '@mayac',
    background: '#e0e9df',
    skin: '#e7b18c',
    hair: '#253a39',
    shirt: '#527c6d',
    hairstyle: 'long',
  },
  {
    handle: 'ct_9pw4',
    name: 'Alex Morgan',
    username: '@alexm',
    background: '#e8e1f2',
    skin: '#bd805e',
    hair: '#44372f',
    shirt: '#756794',
    hairstyle: 'curly',
  },
  {
    handle: 'ct_2rn8',
    name: 'Noah Williams',
    username: '@noahw',
    background: '#dce7ef',
    skin: '#e8b795',
    hair: '#55433c',
    shirt: '#618498',
    hairstyle: 'short',
  },
  {
    handle: 'ct_5vb1',
    name: 'Sofia Rivera',
    username: '@sofiar',
    background: '#f1dfd4',
    skin: '#c88e6a',
    hair: '#48352f',
    shirt: '#ae705c',
    hairstyle: 'long',
  },
  {
    handle: 'ct_8qm3',
    name: 'Jamie Park',
    username: '@jamiep',
    background: '#f0e9ca',
    skin: '#edc2a0',
    hair: '#333a43',
    shirt: '#9c965c',
    hairstyle: 'short',
  },
]

export function findContact(handle: string) {
  return contacts.find((contact) => contact.handle === handle)
}

export function findList(handle: string) {
  if (handle === 'ls_4dn9') return contacts
  if (handle === 'ls_6ty2') return contacts.slice(0, 3)
}

export function avatarSvg(contact: ContactRecord) {
  const hair = {
    long: '<path d="M22 47c-3-26 9-34 26-34 19 0 29 13 26 38l4 28H18z"/>',
    short: '<path d="M24 41c-9-20 6-29 19-25 18-11 35 8 29 28l-8-16-34 4z"/>',
    curly:
      '<path d="M22 44c-14-9-8-22 2-23-2-12 11-16 19-10 9-9 23-2 23 6 14-2 20 15 9 23l-5 11H27z"/>',
  }[contact.hairstyle]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${contact.background}"/><circle cx="82" cy="17" r="26" fill="#fff" opacity=".2"/><g fill="${contact.hair}">${hair}</g><path d="M10 98c0-24 15-32 38-32s38 8 38 32" fill="${contact.shirt}"/><path d="M39 58h18v17c-5 7-13 7-18 0" fill="${contact.skin}"/><path d="M39 60h18v9c-6 4-12 3-18-1" fill="#000" opacity=".08"/><ellipse cx="27" cy="46" rx="5" ry="7" fill="${contact.skin}"/><ellipse cx="69" cy="46" rx="5" ry="7" fill="${contact.skin}"/><path d="M27 34q21-20 42 0v13c0 16-10 24-21 24S27 62 27 47z" fill="${contact.skin}"/><path d="M26 37c-4-19 33-31 43-6l1 8c-13-1-23-8-26-14-2 8-10 12-18 12" fill="${contact.hair}"/><g fill="#303433"><circle cx="39" cy="46" r="1.6"/><circle cx="58" cy="46" r="1.6"/></g><path d="M44 57q4 4 9 0" fill="none" stroke="#8c5147" stroke-width="1.8" stroke-linecap="round"/><path d="M48 47l-2 6h4" fill="none" stroke="#000" stroke-opacity=".13" stroke-width="1.4" stroke-linecap="round"/></svg>`
}
