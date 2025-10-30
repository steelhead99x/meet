# Advanced Segmentation Options - Beyond LiveKit's Default

## Overview

LiveKit v2 uses MediaPipe Selfie Segmentation v1, which is good but not state-of-the-art. Google Meet's HD segmentation (as described in their research blog) uses advanced techniques we can implement.

## What Google Meet Does (From Their Research)

### Key Improvements:
1. **Multi-model approach** - Uses different models for different scenarios
2. **ML-based post-processing** - Additional ML model for mask refinement
3. **Temporal consistency** - Smoothing across frames to reduce flicker
4. **Resolution-independent processing** - Works at different video resolutions
5. **Edge refinement** - Specific focus on hair and complex boundaries
6. **Light segmentation** - Detects and preserves lighting effects on background

### Their Technical Stack:
- **Desktop**: MediaPipe with custom post-processing
- **Mobile**: MLKit segmentation
- **Edge refinement**: Separate lightweight model for boundaries
- **Temporal smoothing**: IIR filters + optical flow

## Best Options for React/Browser

### Option 1: MediaPipe Image Segmenter (Recommended for Quality) ⭐

**Why Better:**
- Newer than Selfie Segmentation
- Multiple output categories (person, hair, clothing, etc.)
- Better edge detection
- More accurate on diverse backgrounds

**Implementation:**

```typescript
// lib/processors/MediaPipeSegmenter.ts
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

export class EnhancedMediaPipeProcessor {
  private segmenter: ImageSegmenter | null = null;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  
  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    
    this.segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
        delegate: 'GPU',
      },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: 'VIDEO',
    });
  }
  
  processFrame(
    videoFrame: VideoFrame, 
    blurRadius: number,
    enhancedDetection: boolean
  ): VideoFrame {
    // Get segmentation mask
    const result = this.segmenter!.segmentForVideo(videoFrame, Date.now());
    
    // result.categoryMask contains:
    // 0 = background
    // 1 = hair
    // 2 = body-skin
    // 3 = face-skin
    // 4 = clothes
    // 5 = others (person)
    
    // Apply our enhanced detection algorithms if enabled
    let mask = result.categoryMask;
    if (enhancedDetection) {
      mask = this.applyEnhancedDetection(mask);
    }
    
    // Apply blur with refined mask
    return this.applyBlurWithMask(videoFrame, mask, blurRadius);
  }
  
  private applyEnhancedDetection(mask: ImageData): ImageData {
    // Apply our algorithms from maskProcessor.ts
    // - Confidence thresholding
    // - Morphological operations
    // - Connected components
    // - Temporal smoothing
    return mask;
  }
}
```

**Pros:**
- ✅ Official Google solution
- ✅ Better quality than Selfie Segmentation v1
- ✅ Multi-class output (can handle hair separately)
- ✅ GPU accelerated
- ✅ Regular updates from Google

**Cons:**
- ❌ Still ~50-70ms latency per frame
- ❌ Requires WASM download (~2-3MB)
- ❌ Similar performance to current solution

---

### Option 2: ONNX Runtime + MODNet (Best Quality) ⭐⭐⭐

**Why Better:**
- State-of-the-art accuracy (better than MediaPipe)
- Specifically designed for portrait matting
- Handles complex backgrounds better
- Better edge refinement for hair

**Model**: MODNet (Matting Objective Decomposition Network)

```typescript
// lib/processors/ONNXSegmenter.ts
import * as ort from 'onnxruntime-web';

export class MODNetProcessor {
  private session: ort.InferenceSession | null = null;
  private previousMask: Float32Array | null = null;
  
  async initialize() {
    // Download and load MODNet model
    // Model: ~25MB, but much better quality
    this.session = await ort.InferenceSession.create(
      '/models/modnet_photographic_portrait_matting.onnx',
      {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all',
      }
    );
  }
  
  async processFrame(
    videoFrame: VideoFrame,
    blurRadius: number
  ): Promise<VideoFrame> {
    // Preprocess: Resize to 512x512 (MODNet input size)
    const input = this.preprocessFrame(videoFrame);
    
    // Run inference
    const feeds = { input: input };
    const results = await this.session!.run(feeds);
    const alphaMask = results.output.data as Float32Array;
    
    // Apply temporal smoothing
    if (this.previousMask) {
      for (let i = 0; i < alphaMask.length; i++) {
        alphaMask[i] = alphaMask[i] * 0.7 + this.previousMask[i] * 0.3;
      }
    }
    this.previousMask = new Float32Array(alphaMask);
    
    // Apply blur with high-quality mask
    return this.applyBlurWithAlphaMask(videoFrame, alphaMask, blurRadius);
  }
  
  private preprocessFrame(frame: VideoFrame): ort.Tensor {
    // Resize to 512x512
    // Normalize to [-1, 1]
    // Convert to NCHW format (batch, channels, height, width)
    const canvas = new OffscreenCanvas(512, 512);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(frame, 0, 0, 512, 512);
    
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const float32Data = new Float32Array(3 * 512 * 512);
    
    // Convert to [-1, 1] range and NCHW format
    for (let i = 0; i < 512 * 512; i++) {
      float32Data[i] = (imageData.data[i * 4] / 127.5) - 1.0; // R
      float32Data[512 * 512 + i] = (imageData.data[i * 4 + 1] / 127.5) - 1.0; // G
      float32Data[512 * 512 * 2 + i] = (imageData.data[i * 4 + 2] / 127.5) - 1.0; // B
    }
    
    return new ort.Tensor('float32', float32Data, [1, 3, 512, 512]);
  }
}
```

**Pros:**
- ✅ **Best quality available** in browser
- ✅ Superior edge detection (especially hair)
- ✅ Better with complex backgrounds
- ✅ Continuous alpha mask (0-1) vs binary
- ✅ Can use WebGL for GPU acceleration

**Cons:**
- ❌ Larger model (~25MB vs 2-3MB)
- ❌ Slower (~80-120ms per frame)
- ❌ More setup complexity
- ❌ Need to host model file

---

### Option 3: TensorFlow.js + Custom Model (Most Flexible) ⭐⭐

**Why Better:**
- Can use any TensorFlow model
- Good community support
- Easy to train custom models
- Can optimize for specific use cases

```typescript
// lib/processors/TFJSSegmenter.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

export class TFJSSegmentationProcessor {
  private model: tf.GraphModel | null = null;
  
  async initialize() {
    await tf.ready();
    await tf.setBackend('webgl');
    
    // Load model - could be:
    // 1. Custom trained model
    // 2. DeepLab v3+
    // 3. U²-Net
    // 4. BiSeNet
    this.model = await tf.loadGraphModel('/models/deeplabv3/model.json');
  }
  
  async processFrame(
    videoFrame: VideoFrame,
    blurRadius: number
  ): Promise<VideoFrame> {
    return tf.tidy(() => {
      // Convert video frame to tensor
      const tensor = tf.browser.fromPixels(videoFrame);
      
      // Resize to model input size (e.g., 513x513 for DeepLab)
      const resized = tf.image.resizeBilinear(tensor, [513, 513]);
      
      // Normalize
      const normalized = resized.div(127.5).sub(1);
      
      // Add batch dimension
      const batched = normalized.expandDims(0);
      
      // Run inference
      const prediction = this.model!.predict(batched) as tf.Tensor;
      
      // Get person mask (class 15 in PASCAL VOC)
      const mask = tf.argMax(prediction, -1);
      const personMask = mask.equal(15);
      
      // Convert back to image
      const maskImage = personMask.squeeze().expandDims(-1);
      const maskFloat = maskImage.toFloat().mul(255);
      
      // Apply blur using mask
      return this.applyBlurWithTensor(tensor, maskFloat, blurRadius);
    });
  }
}
```

**Pros:**
- ✅ Very flexible
- ✅ Good documentation
- ✅ Easy to customize
- ✅ Active community
- ✅ WebGL backend available

**Cons:**
- ❌ Performance varies by model
- ❌ Can be memory intensive
- ❌ Requires good ML knowledge for custom models

---

### Option 4: Hybrid Approach (Google Meet Style) ⭐⭐⭐⭐

**Combine multiple techniques for best results:**

```typescript
// lib/processors/HybridSegmenter.ts
export class GoogleMeetStyleProcessor {
  private segmenter: MediaPipeSegmenter;
  private edgeRefiner: LightweightEdgeModel;
  private temporalSmoother: TemporalConsistency;
  private maskProcessor: EnhancedMaskProcessor;
  
  async processFrame(
    videoFrame: VideoFrame,
    blurRadius: number,
    config: ProcessorConfig
  ): Promise<VideoFrame> {
    // Stage 1: Base segmentation (MediaPipe or ONNX)
    let mask = await this.segmenter.segment(videoFrame);
    
    // Stage 2: Apply our enhanced person detection
    // - Confidence thresholding
    // - Morphological operations
    // - Connected components
    mask = this.maskProcessor.enhance(mask, config.enhancedDetection);
    
    // Stage 3: Edge refinement (lightweight ML model)
    // Focus on hair and complex boundaries
    mask = await this.edgeRefiner.refine(mask, videoFrame);
    
    // Stage 4: Temporal smoothing
    // Reduce flickering across frames
    mask = this.temporalSmoother.smooth(mask);
    
    // Stage 5: Apply blur with refined mask
    return this.applyBlurWithMask(videoFrame, mask, blurRadius);
  }
}
```

**Components:**

1. **Base Segmentation**: MediaPipe or MODNet
2. **Enhanced Detection**: Our algorithms from `maskProcessor.ts`
3. **Edge Refinement**: Lightweight model (~1-2MB) just for edges
4. **Temporal Smoothing**: IIR filter + optical flow estimation
5. **Quality Blur**: Gaussian blur with mask feathering

**Pros:**
- ✅ **Best overall quality**
- ✅ Handles all scenarios well
- ✅ Customizable per device capability
- ✅ Production-ready approach

**Cons:**
- ❌ Most complex to implement
- ❌ Highest computational cost
- ❌ Requires multiple models

---

## Recommended Implementation Path

### Phase 1: Quick Win (2-3 days)
**Upgrade to MediaPipe Image Segmenter**
- Drop-in replacement for current solution
- Immediate quality improvement
- Minimal code changes
- Use our existing mask processing

```typescript
// In CameraSettings.tsx, replace BackgroundProcessor with:
import { EnhancedMediaPipeProcessor } from './processors/MediaPipeSegmenter';

const processor = new EnhancedMediaPipeProcessor({
  blurRadius: config.blurRadius,
  delegate: config.segmenterOptions.delegate,
  enhancedDetection: config.enhancedPersonDetection,
});
```

### Phase 2: Advanced Quality (1-2 weeks)
**Add ONNX + MODNet for high quality mode**
- Offer as "Ultra+ Quality" option
- Only for high-end devices
- Significantly better edges and accuracy

```typescript
// Add new quality level
export type BlurQuality = 'low' | 'medium' | 'high' | 'ultra' | 'ultra-plus';

// In BlurConfig.ts
'ultra-plus': {
  blurRadius: 150,
  processor: 'modnet', // Use MODNet instead of MediaPipe
  segmenterOptions: { delegate: 'GPU' },
  enhancedPersonDetection: { /* best settings */ },
}
```

### Phase 3: Google Meet Style (3-4 weeks)
**Implement hybrid approach**
- Multiple models working together
- Edge refinement model
- Temporal consistency
- Adaptive quality based on scene

---

## Performance Comparison

| Approach | Latency | Quality | Model Size | GPU Usage |
|----------|---------|---------|------------|-----------|
| Current (MediaPipe v1) | 30-50ms | Good | 2MB | Medium |
| MediaPipe Image Seg | 40-60ms | Better | 3MB | Medium |
| MODNet (ONNX) | 80-120ms | Best | 25MB | High |
| TensorFlow.js DeepLab | 60-90ms | Very Good | 8MB | Medium-High |
| Hybrid Approach | 100-150ms | Excellent | 30MB | High |

---

## Code Example: Custom LiveKit Processor

```typescript
// lib/processors/CustomBackgroundProcessor.ts
import { TrackProcessor } from 'livekit-client';

export class CustomBackgroundProcessor implements TrackProcessor {
  private segmenter: MODNetProcessor | MediaPipeSegmenter;
  private maskProcessor: EnhancedMaskProcessor;
  
  constructor(config: BlurConfig) {
    // Choose segmenter based on quality setting
    if (config.quality === 'ultra-plus') {
      this.segmenter = new MODNetProcessor();
    } else {
      this.segmenter = new MediaPipeSegmenter();
    }
    
    this.maskProcessor = new EnhancedMaskProcessor(
      config.enhancedPersonDetection
    );
  }
  
  async processFrame(frame: VideoFrame): Promise<VideoFrame> {
    // Get base segmentation
    let mask = await this.segmenter.segment(frame);
    
    // Apply enhanced person detection
    mask = this.maskProcessor.process(mask);
    
    // Apply blur
    return this.applyBlur(frame, mask);
  }
  
  destroy() {
    this.segmenter.cleanup();
  }
}
```

---

## Next Steps

1. **Start with MediaPipe Image Segmenter** - Easy upgrade, immediate improvement
2. **Integrate maskProcessor.ts** - Enable our enhanced detection algorithms
3. **Add MODNet option** - For users who want best quality
4. **Implement temporal smoothing** - Reduce flicker
5. **Add edge refinement** - Polish the final result

## Resources

- **MediaPipe**: https://developers.google.com/mediapipe/solutions/vision/image_segmenter
- **ONNX Runtime Web**: https://onnxruntime.ai/docs/tutorials/web/
- **MODNet Model**: https://github.com/ZHKKKe/MODNet
- **TensorFlow.js**: https://www.tensorflow.org/js
- **Google Meet Blog**: https://research.google/blog/high-definition-segmentation-in-google-meet/

Would you like me to implement Phase 1 (MediaPipe Image Segmenter upgrade) first?


