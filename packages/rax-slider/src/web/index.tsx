import { createElement, Component, createRef } from 'rax';
import cloneElement from 'rax-clone-element';
import findDOMNode from 'rax-find-dom-node';
import Children from 'rax-children';
import * as PropTypes from 'prop-types';
import View from 'rax-view';
import SwipeEvent from '../SwipeEvent';
import cx from 'classnames';
import { SliderProps } from '../types';
import '../index.css';

const SWIPE_LEFT = 'SWIPE_LEFT';
const SWIPE_RIGHT = 'SWIPE_RIGHT';

class Slider extends Component<SliderProps, any> {
  public static defaultProps = {
    horizontal: true,
    showsPagination: true,
    loop: true,
    autoPlay: false,
    autoPlayInterval: 3000,
    speed: 500,
    cssEase: 'ease',
    index: 0,
    paginationStyle: {},
    initialVelocityThreshold: 0.7,
    verticalThreshold: 10,
    horizontalThreshold: 10,
    vertical: false
  };
  public static propTypes = {
    onChange: PropTypes.func,
    paginationStyle: PropTypes.object
  };
  private index: number;
  private height: number;
  private width: number;
  private loopIdx: number;
  private offsetX: number;
  private isSwiping: boolean;
  private total: number;
  private swipeView: any;
  private childRefs: any[];
  private isAutoPlay: boolean;
  private autoPlayTimer: any;
  private isInTransition: boolean;

  public constructor(props: SliderProps) {
    super(props);
    this.index = props.index;
    this.height = parseFloat(`${props.height}`);
    this.width = parseFloat(`${props.width}`);
    this.loopIdx = props.index;
    this.offsetX = this.index * this.width;
    this.isSwiping = false;
    this.swipeView = createRef();
    this.childRefs = [];
    this.total = 0;
    this.autoPlayTimer = null;
    this.isAutoPlay = false;
  }

  public componentDidMount() {
    if (this.props.autoPlay && this.total > 1) {
      this.isAutoPlay = true;
      this.autoPlay();
    }
  }

  public componentDidUpdate() {
    if (!this.isAutoPlay && this.props.autoPlay && this.total > 1) {
      this.isAutoPlay = true;
      this.autoPlay();
    }
  }

  public componentWillUnmount() {
    this.autoPlayTimer && clearInterval(this.autoPlayTimer);
  }

  private autoPlay() {
    const autoPlayInterval = this.props.autoPlayInterval;
    if (this.isSwiping) return;
    this.autoPlayTimer && clearInterval(this.autoPlayTimer);
    const interval = () => {
      if (this.isLoopEnd()) return;
      this.slideTo(this.index + 1);
    };
    this.autoPlayTimer = setInterval(interval, autoPlayInterval);
  }

  public slideTo(index: number) {
    if (this.index === index) return;
    if (this.isInTransition) return;
    if (this.isSwiping) return;
    if (this.total < 2) return;

    this.index = index;

    // Reset slider container's index when out of edge
    if (this.index > this.total) {
      this.index = 0;
    }
    if (this.index < -1) {
      this.index = this.total - 1;
    }

    const { speed, cssEase } = this.props;
    this.isInTransition = true;
    this.offsetX = this.index * this.width;
    const realIndex = this.loopedIndex();
    // translate3d for performance optimization
    const swipeView = findDOMNode(this.swipeView.current);
    const styleText = `translate3d(${-1 * this.offsetX}rpx, 0rpx, 0rpx)`;
    swipeView.style.transitionProperty = 'all';
    swipeView.style.transitionDuration = `${speed}ms`;
    swipeView.style.transitionTimingFunction = cssEase;
    swipeView.style.transform = styleText;
    swipeView.style.webkitTransform = styleText;
    this.loopIdx = this.index < 0 && realIndex !== 0 ? this.total - realIndex : realIndex;
    this.childRefs[this.loopIdx].current.style.left =
      this.offsetX / 750 * document.documentElement.clientWidth + 'px';
    if (this.props.onChange) {
      this.props.onChange({ index: this.loopIdx });
    }
    // forceUpdate
    this.forceUpdate();
  }

  private onSwipeBegin = () => {
    this.isSwiping = true;
    this.isInTransition = true;
    clearInterval(this.autoPlayTimer);
  };

  private isLoopEnd() {
    const realIndex = this.loopedIndex();
    const num = this.total;
    if (!this.props.loop && (realIndex >= num - 1 || realIndex <= 0)) {
      return true;
    }
    return false;
  }

  private onSwipe = ({ direction, distance, velocity }) => {
    if (this.isLoopEnd()) return;
    const changeX = distance / document.documentElement.clientWidth * 750 - this.offsetX;
    const swipeView = findDOMNode(this.swipeView.current);
    const styleText = `translate3d(${changeX / 750 * document.documentElement.clientWidth}px, 0px, 0px)`;

    // move next page
    this.childRefs[this.index >= this.total - 1 ? 0 : this.index + 1].current.style.left = (this.index + 1) * this.width / 750 * document.documentElement.clientWidth + 'px';

    // move pre page
    this.childRefs[this.index <= 0 ? this.total - 1 : this.index - 1].current.style.left = (this.index - 1) * this.width / 750 * document.documentElement.clientWidth + 'px';

    swipeView.style.transitionDuration = '0s';
    swipeView.style.transform = styleText;
    swipeView.style.webkitTransform = styleText;
  };

  private onSwipeEnd = ({ direction, distance, velocity }) => {
    this.isSwiping = false;
    this.isInTransition = false;
    const num = this.total;
    const realIndex = this.loopedIndex();
    if (
      !(
        this.isLoopEnd() &&
        (realIndex >= num - 1 && direction === SWIPE_LEFT ||
          realIndex <= 0 && direction === SWIPE_RIGHT)
      )
    ) {
      this.slideTo(this.index + (direction === 'SWIPE_LEFT' ? 1 : -1));
    }
    if (this.props.autoPlay) {
      this.autoPlay();
    }
  };

  // index from 0 to length
  private loopedIndex(index = this.index, total = this.total) {
    return Math.abs(index) % total;
  }

  private renderPagination() {
    if (this.total <= 1) return null;
    const { paginationStyle = {}, activeDot, normalDot } = this.props;
    let dots = [];
    const { itemSize, itemColor, itemSelectedColor, ...otherStyle } = paginationStyle;
    const size = {
      width: itemSize,
      height: itemSize
    };
    const ActiveDot = activeDot || (
      <View
        className="rax-slider-dot rax-slider-dot-active"
        style={{ backgroundColor: itemSelectedColor, ...size }}
      />
    );
    const NormalDot = normalDot || (
      <View className="rax-slider-dot" style={{ backgroundColor: itemColor, ...size }} />
    );
    const realIndex = this.loopIdx;
    for (let i = 0; i < this.total; i++) {
      dots.push(
        i === realIndex ? cloneElement(ActiveDot, { key: i }) : cloneElement(NormalDot, { key: i })
      );
    }
    return (
      <View className="rax-slider-pagination" style={otherStyle}>
        {dots}
      </View>
    );
  }

  private getPages = () => {
    const { children } = this.props;
    return Children.map(children, (child, i) => {
      const ref = createRef<HTMLDivElement>();
      const translateStyle = {
        width: this.width + 'rpx',
        height: this.height + 'rpx',
        left: i * this.width + 'rpx'
      };
      this.childRefs[i] = ref;
      return (
        <View
          ref={ref}
          className={cx('rax-slider-children', 'childWrap' + i)}
          style={translateStyle}
          key={i}
        >
          {child}
        </View>
      );
    });
  };

  private renderSwipeView(pages) {
    const {
      initialVelocityThreshold,
      verticalThreshold,
      vertical,
      horizontalThreshold
    } = this.props;
    const style = {
      width: this.width + 'rpx',
      height: this.height + 'rpx'
    };
    return this.total > 1 ? (
      <SwipeEvent
        className="rax-slider-swipe-wrapper"
        style={style}
        onSwipeBegin={this.onSwipeBegin}
        onSwipeEnd={this.onSwipeEnd}
        onSwipe={this.onSwipe}
        initialVelocityThreshold={initialVelocityThreshold}
        verticalThreshold={verticalThreshold}
        vertical={vertical}
        horizontalThreshold={horizontalThreshold}
      >
        <View
          ref={this.swipeView}
          className="rax-slider-swipe"
          style={{
            ...style,
            transform: `translate3d(${-1 * this.offsetX}rpx, 0rpx, 0rpx)`
          }}
          onTransitionEnd={this.handleTransitionEnd}
        >
          {pages}
        </View>
      </SwipeEvent>
    ) : (
      <View
        ref={this.swipeView}
        className="rax-slider-swipe"
        style={style}
      >
        {pages}
      </View>
    );
  }

  private handleTransitionEnd = () => {
    this.isInTransition = false;

    // Reset container's position when it's out of edge and animation ended
    if (this.index === this.total) {
      this.index = 0;
      this.resetSliderIndex();
    } else if (this.index === -1) {
      this.index = this.total - 1;
      this.resetSliderIndex();
    }
  }

  private resetSliderIndex = () => {
    this.offsetX = this.index * this.width;
    const swipeView = findDOMNode(this.swipeView.current);
    const styleText = `translate3d(${-1 * this.offsetX}rpx, 0rpx, 0rpx)`;
    swipeView.style.transitionDuration = '0s';
    this.childRefs[this.loopIdx].current.style.left =
      this.offsetX / 750 * document.documentElement.clientWidth + 'px';
    swipeView.style.transform = styleText;
    swipeView.style.webkitTransform = styleText;
    this.forceUpdate();
  }

  public render() {
    const { style, showsPagination = true, className, children } = this.props;
    this.total = Children.toArray(children).length;
    return (
      <View style={style} className={cx('rax-slider', className)}>
        {this.renderSwipeView(this.getPages())}
        {showsPagination && this.renderPagination()}
      </View>
    );
  }
}

export default Slider;
