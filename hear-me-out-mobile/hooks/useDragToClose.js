import { useRef } from "react";
import { Animated, PanResponder } from "react-native";

/**
 * Lets a bottom-sheet handle be dragged down to dismiss, or up to
 * bounce/rubber-band before snapping back. Attach `panHandlers` to the
 * handle (or its touch area) and `translateY` to the sheet's transform.
 */
export default function useDragToClose(onClose, threshold = 100) {
  const translateY = useRef(new Animated.Value(0)).current;

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
            translateY.setValue(0);
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
