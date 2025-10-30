# Quick Fix: Improve Person Detection (Stop Detecting Boxes as People)

## Problem
Background objects (boxes, furniture, shelves) are being detected as people and not properly blurred.

## Solution: 3-Step Fix (Takes 2 Minutes)

### Step 1: Fix Your Lighting ⭐ **DO THIS FIRST**
**This is THE most important fix - solves 80% of detection issues**

✅ **Add a lamp or light source in FRONT of you**
- Desk lamp on your desk pointing at your face
- Room lights in front of you
- Natural light from window in front (not behind)

❌ **Close blinds or move if you have a window BEHIND you**
- Backlighting makes you a dark silhouette
- The algorithm can't distinguish you from background objects

**Why this works:** When you're well-lit from the front, your face and body have clear edges that the ML model can easily detect. Backlighting makes everything the same darkness.

### Step 2: Enable High Quality Mode (30 seconds)
1. Click the **Settings** gear icon (⚙️) in the video interface
2. Click the **Media** tab
3. In the **Advanced** section, find **"Blur Quality"**
4. Change from "Medium" to **"High"** or **"Ultra"**

**Why this works:** Higher quality uses more advanced edge detection and stronger blur separation.

### Step 3: Simplify Your Background (1 minute)
✅ **Move away from:**
- Shelves with books/boxes
- Cluttered desk areas
- Complex patterns

✅ **Ideal setup:**
- Plain wall behind you (best)
- 2-3 feet of space between you and background
- Simple, uniform background

## Advanced Fix (Optional - For Power Users)

If you still have issues after the above, try **Custom Segmentation**:

1. In Settings > Media > Advanced
2. Enable **"Custom Segmentation"** toggle
3. Make sure these are checked:
   - ✅ **Enhanced Person Detection** (blue highlight)
   - ✅ **Temporal Smoothing**
   - ✅ **Edge Refinement**
4. Move **"Blur Strength"** slider to **60-80**
5. Move **"Edge Quality"** slider to **40-50%**

## Troubleshooting

### Still seeing background objects?
→ **Add more front lighting** (this is 90% of the fix)
→ Move further from background
→ Increase "Blur Strength" slider in Custom Segmentation

### Edges look jagged or flickering?
→ Enable "Temporal Smoothing" in Custom Segmentation
→ Increase "Edge Quality" slider to 40-50%

### Video is laggy or freezing?
→ Lower quality back to "Medium"
→ Close other apps using CPU/GPU
→ Disable "Edge Refinement" in Custom Segmentation

## Why This Happens

**Technical reason:** LiveKit uses MediaPipe's segmentation model which was trained on general objects (people, cars, animals, furniture - everything). It doesn't know that you only want to detect PEOPLE and blur everything else.

**Zoom comparison:** Zoom likely uses custom ML models trained specifically on millions of video conference images. They know exactly what a person looks like in a video call vs background objects.

**Privacy trade-off:** LiveKit processes video locally in your browser (privacy), while Zoom can use powerful servers (less privacy, better quality).

## The #1 Most Important Thing

> 🔦 **LIGHTING, LIGHTING, LIGHTING!**
> 
> Even the best ML model in the world (like Zoom's) struggles with bad lighting. A $10 desk lamp in front of you will make more difference than any software setting.
>
> **Front lighting** = Clear person detection ✅  
> **Backlighting** = Everything looks the same ❌

## Visual Guide to Lighting

**BAD Setup (Don't do this):**
```
[WINDOW with bright light] ← [YOU sitting here] → [Camera]
Result: You're a dark silhouette, boxes look like people
```

**GOOD Setup (Do this):**
```
[LAMP/LIGHT] → [YOU sitting here] ← [Camera]  ...  [Wall/Background]
Result: Your face is bright and clear, background is darker
```

## Quick Checklist

- [ ] Added light source in front of me
- [ ] No bright window behind me
- [ ] Set Blur Quality to "High" in Settings
- [ ] Moved away from cluttered background (if possible)
- [ ] Tried Custom Segmentation (optional)

## Still Need Help?

Read the full documentation:
- `PERSON_DETECTION_IMPROVEMENTS.md` - Complete guide with all details
- `SEGMENTATION_IMPROVEMENTS_SUMMARY.md` - Technical summary of changes

The tooltip (blue "?" icon next to "Background Effects") also has detailed tips!

