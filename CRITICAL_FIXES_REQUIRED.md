# Critical Fixes Required - Code Examples

## CRIT-001: Fix TypeScript Compilation

### SceneCard.test.tsx - Line 20

**Change**:
```typescript
// FROM:
import { describe, it, expect, beforeEach } from 'vitest';

// TO:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
```

### Toast.test.tsx - Line 263-272

**Change to properly initialize hookResult**:
```typescript
// Use renderHook properly
const { result } = renderHook(() => useToast());

act(() => {
  result.current.addToast('test', 'success');  // Now works correctly
});
```

---

## CRIT-002: Fix Directory Traversal

### File: server/x32/scene-parser.ts (Lines 195-210)

**Add this method to validate paths**:
```typescript
private getFilePath(filename: string): string {
  const sanitized = filename
    .replace(/[<>:"/\|?*]/g, '_')
    .replace(/\.+$/g, '')
    .replace(/\.\./g, '_');  // Prevent traversal
  
  const withExtension = sanitized.endsWith('.scn') 
    ? sanitized 
    : `${sanitized}.scn`;
  
  const filePath = path.join(this.sceneDir, withExtension);
  
  // Verify path is within sceneDir
  const resolvedPath = path.resolve(filePath);
  const resolvedSceneDir = path.resolve(this.sceneDir);
  
  if (!resolvedPath.startsWith(resolvedSceneDir + path.sep)) {
    throw new Error('Invalid filename: path traversal detected');
  }
  
  return filePath;
}
```

---

## CRIT-003: Add Input Validation

### File: server/api/scenes.ts

**Add at top**:
```typescript
import { z } from 'zod';

const sceneIdSchema = z.string()
  .min(1).max(256);

const createSceneSchema = z.object({
  name: z.string().min(1).max(32).trim(),
  notes: z.string().max(200).optional().default(''),
});
```

**Update each endpoint with validation**:
```typescript
// Example: GET endpoint
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sceneId = sceneIdSchema.parse(req.params.id);
    const scene = await storageManager.getScene(sceneId);
    // ... rest
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }
    // ... handle other errors
  }
});
```

---

## Quick Fix Steps

1. **TypeScript**: Add missing import, fix variable init (30 min)
2. **Directory Traversal**: Add path validation (20 min)
3. **API Validation**: Add Zod schemas (90 min)
4. **Test**: Run build and tests (10 min)

Total: ~2-3 hours

---

See REVIEW_SUMMARY.md for quick overview
See docs/review-report.md for detailed analysis
