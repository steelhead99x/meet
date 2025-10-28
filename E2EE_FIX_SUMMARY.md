# E2EE Encryption Error Fix

## Issue
Users were experiencing "Encryption error: Encryption setup failed" when joining rooms with end-to-end encryption enabled.

## Root Cause
The E2EE passphrase was being **double-decoded**, causing an incorrect encryption key to be passed to the `ExternalE2EEKeyProvider`.

### What was happening:
1. In `lib/useSetupE2EE.ts` (line 25), the passphrase from the URL hash was decoded:
   ```typescript
   const e2eePassphrase = typeof window !== 'undefined' 
     ? decodePassphrase(location.hash.substring(1)) 
     : undefined;
   ```

2. In `app/rooms/[roomName]/PageClientImpl.tsx` (line 190), the already-decoded passphrase was being decoded **again**:
   ```typescript
   keyProvider.setKey(decodePassphrase(e2eePassphrase))  // ❌ Wrong!
   ```

This double-decoding resulted in a corrupted encryption key, causing the E2EE setup to fail.

## Solution
Removed the redundant `decodePassphrase()` call in `PageClientImpl.tsx` and passed the passphrase directly to `setKey()`:

```typescript
keyProvider.setKey(e2eePassphrase)  // ✅ Correct!
```

## Files Modified
- `app/rooms/[roomName]/PageClientImpl.tsx`:
  - Line 190: Changed `keyProvider.setKey(decodePassphrase(e2eePassphrase))` to `keyProvider.setKey(e2eePassphrase)`
  - Line 4: Removed unused `decodePassphrase` import

## Verification
✅ TypeScript compilation passes with no errors
✅ Implementation now matches LiveKit's official E2EE documentation pattern
✅ `VideoConferenceClientImpl.tsx` was already correct (no changes needed)

## LiveKit Documentation Reference
According to the [LiveKit E2EE documentation](https://docs.livekit.io/home/client/tracks/encryption/), the correct pattern is:

```typescript
// 1. Initialize the external key provider
const keyProvider = new ExternalE2EEKeyProvider();

// 2. Configure room options
const roomOptions: RoomOptions = {
  e2ee: {
    keyProvider: keyProvider,
    worker: new Worker(new URL('livekit-client/e2ee-worker', import.meta.url)),
  },
};

// 3. Create the room
const room = new Room(roomOptions);

// 4. Set the encryption key (already decoded!)
await keyProvider.setKey(yourSecureKey);

// 5. Enable E2EE
await room.setE2EEEnabled(true);

// 6. Connect
await room.connect(url, token);
```

The key should be passed directly to `setKey()` without any additional decoding.

## Testing Recommendations
1. Test joining a room with E2EE enabled (URL with `#passphrase` hash)
2. Verify that encryption indicators show properly
3. Confirm that encrypted media streams work correctly
4. Test with different browsers to ensure compatibility

