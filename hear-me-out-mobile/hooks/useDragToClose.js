import { useEffect, useRef } from "react";
import { Animated, PanResponder } from "react-native";

/**
 * Lets a bottom-sheet handle be dragged down to dismiss, or up to
 * bounce/rubber-band before snapping back. Attach `panHandlers` to the
 * handle (or its touch area) and `translateY` to the sheet's transform.
 *
 * `isOpen` is the sheet's own visible/open state — it's used to snap the
 * sheet's position back to 0 the moment it opens again, rather than doing
 * that reset right as it closes (which raced the modal's own dismissal and
 * caused a one-frame "snap back into view, then vanish" flicker).
 */
export default function useDragToClose(onClose, isOpen, threshold = 100) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) translateY.setValue(0);
  }, [isOpen, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderMove: (_, gesture) => {
        // Drag down moves 1:1; drag up rubber-bands for a light bounce feel.
        translateY.setValue(gesture.dy > 0 ? gesture.dy : gesture.dy / 4);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > threshold || gesture.vy > 0.8) {
          Animated.timing(translateY, {
            toValue: 700,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  return { translateY, panHandlers: panResponder.panHandlers };
}
