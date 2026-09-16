# lumen

## tech stack:
frontend: vite + react + typescript
backend: express + typescript
ui kit/compnent library: mantine
db: mongo
images: pixaby
auth: jwt

## repo layout
```
client/ #frontend
server/ #backend
README.md
README.txt
```

## data model
user:
- username (string)
- email (string)
- passwordHash (string)

collage:
- title (string)
- prompt (string) (not mvp)
- caption (string)
- visibility (string)
- rows (int)
- cols (int)
- ownderId (objectId)

collageSlot:
- index (int)
- imageUrl (string)
- pixabyId (string)

friendship (not mvp):
- fromUser (objectId)
- toUser (objectId)
- status (string)
