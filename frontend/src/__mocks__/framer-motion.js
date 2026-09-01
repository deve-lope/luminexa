const React = require('react');

const motion = new Proxy(
  {},
  {
    get: (_, tag) =>
      function MotionStub({ children, ...props }) {
        const {
          initial,
          animate,
          whileInView,
          viewport,
          transition,
          variants,
          style,
          ...rest
        } = props;
        return React.createElement(tag, rest, children);
      },
  },
);

module.exports = {
  __esModule: true,
  motion,
  useReducedMotion: jest.fn(() => false),
  useInView: jest.fn(() => true),
  useScroll: jest.fn(() => ({ scrollYProgress: { get: () => 0 } })),
  useTransform: jest.fn((_input, _inputRange, outputRange) =>
    Array.isArray(outputRange) ? outputRange[0] : outputRange,
  ),
};
