import React, { Component } from "react";
import Scroll from "../components/scroll";
import Loading from './loading';
import { Event, IDefaultDown, IDefaultUp } from "../components/const";
import './index.less';

const defaultProps = {
  requestErrorTime: 10000,
  pullDownTime: 200,
  pullDownBounceTime: 0,
  pullDownContent: '释放刷新',
  showLoading: true,
  finishUpContent: '没有更多数据了',
  errorContent: '加载失败，点击重试',
  customNoData: false, // 自定义一条数据都没有的样式。一般是配合没有数据时，有数据之后，一定要置为false，否则上拉会出现问题
  // Scroll相关的设置
  down: {},
  up: {},
  isLockX: false,
  isLoadFull: true,
  useBodyScroll: false,
};

type IProps = {
  pullUp?: () => Promise<boolean>,
  pullDown: () => Promise<boolean>,
  requestErrorTime?: number, // 请求多少秒未响应，错误提示
  pullDownTime?: number,
  pullDownBounceTime?: number, // 下拉回弹延迟结束的时间
  showLoading?: boolean,
  finishUpContent?: string,
  pullDownContent?: string,
  errorContent?: string,
  height?: number,
  customNoData?: boolean,
  useBodyScroll?: boolean,
  isLockX?: boolean,
  isLoadFull?: boolean,
  down?: IDefaultDown,
  up?: IDefaultUp,
}

interface IState {
  isFinishUp: boolean;
  isBeforePullDown: boolean;
  isPullingDown: boolean;
  isPullingUp: boolean;
  isPullUpError: boolean;
}

class ScrollView extends Component<IProps, IState> {
  scroll: any;
  scrollRef: React.RefObject<any>;
  isBouncing: boolean;
  firstIntoPage: boolean;
  requestErrorTimer: number;
  pullDownTimer: number;
  pullDownBounceTimer: number;
  static defaultProps = defaultProps;

  constructor(props: IProps) {
    super(props);
    // this.scroll = null;
    this.isBouncing = false;
    this.scrollRef = React.createRef();
    this.firstIntoPage = false;
    this.requestErrorTimer = 0;
    this.pullDownTimer = 0;
    this.pullDownBounceTimer = 0;

    this.state = {
      isFinishUp: false,
      isBeforePullDown: false,
      isPullingDown: false,
      isPullingUp: false,
      isPullUpError: false,
    }
  }

  componentDidMount() {
    const { height, useBodyScroll, up, down, isLockX, isLoadFull } = this.props;
    const dom = this.scrollRef.current;
    this.scroll = new Scroll(dom as HTMLDivElement, {
      useBodyScroll,
      isLockX,
      isLoadFull,
      up,
      down,
    });
    if (!useBodyScroll) {
      dom.style.height = height ? `${height}px` : '100vh';
    }
    this.initEvent();
  }

  componentWillUnmount() {
    this.scroll.destroy();
    clearTimeout(this.pullDownTimer);
    clearTimeout(this.pullDownBounceTimer);
    clearTimeout(this.requestErrorTimer);
  }

  initEvent() {
    (this.scroll as Scroll).on(Event.scroll, () => {
    }, this);
    (this.scroll as Scroll).on(Event.pullUp, this.pullUp, this);
    (this.scroll as Scroll).on(Event.pullingDown, this.pullingDown, this);
    (this.scroll as Scroll).on(Event.pullDown, this.pullDown, this);
    (this.scroll as Scroll).on(Event.cancelPullDown, this.cancelPullDown, this);
  }

  endPullUp(bol = true) {
    this.setState({ isFinishUp: bol });
    this.scroll.endPullUp(bol);
  }

  private cancelPullDown() {
    this.setState({ isBeforePullDown: false });
  }

  private pullingDown(height: number) {
    if (this.isBouncing || height <= 0) return;
    this.setState({ isBeforePullDown: true });
  }

  private pullDown() {
    console.log('pullDown');
    const { pullDown, pullDownTime } = this.props;
    if (!pullDown || this.isBouncing) return;

    this.cancelPullUp();

    this.isBouncing = true;
    this.setState({
      isPullingDown: true,
      isFinishUp: false,
      isBeforePullDown: false,
      isPullUpError: false,
    });

    const PromiseSuccessCallback = (finishUp: boolean) => {
      console.log('kkk');
      clearTimeout(this.pullDownTimer);
      this.pullDownTimer = window.setTimeout(() => {
        this.setState({ isPullingDown: false });
        this.endPullUp(finishUp);
        this.afterPullDown(finishUp);
      }, pullDownTime);
    }

    this.handleRequestError(pullDown)
      .then(PromiseSuccessCallback)
      .catch(() => {
        this.setState({ isPullUpError: true });
      });
  }

  private cancelPullUp() {
    if (!this.state.isPullingUp) return;
    this.setState({ isPullingUp: false });
    this.endPullUp(false);
  }

  private afterPullDown(finishUp: boolean) {
    const { pullDownBounceTime } = this.props;
    clearTimeout(this.pullDownBounceTimer);
    this.pullDownBounceTimer = window.setTimeout(() => {
      this.isBouncing = false;
      this.scroll.endPullDown(finishUp);
    }, pullDownBounceTime);
  }

  private pullUp (showLoading: boolean) {
    const { pullUp } = this.props;
    const { isPullingUp, isFinishUp } = this.state;
    if (!pullUp || isPullingUp || isFinishUp) return;

    if (showLoading) this.setState({ isPullingUp: true });

    const PromiseSuccessCallback = (finishUp: boolean) => {
      if (this.firstIntoPage) this.firstIntoPage = false;
      if (showLoading) this.setState({ isPullingUp: false });
      this.endPullUp(finishUp);
      !finishUp && this.scroll.resetPullUp();
    };

    this.handleRequestError(pullUp)
      .then(PromiseSuccessCallback)
      .catch(() => {
        this.setState({ isPullingUp: false, isPullUpError: true });
      });
  }

  private async handleRequestError(fn: () => Promise<boolean>) {
    const errorPromise: Promise<boolean> = new Promise((resolve, reject) => {
      console.log(this.props.requestErrorTime);
      this.requestErrorTimer = window.setTimeout(() => {
        Scroll.info('request callback error');
        reject(false);
      }, this.props.requestErrorTime);
    });
    const res = await Promise.race([fn(), errorPromise]) as boolean;
    clearTimeout(this.requestErrorTimer);
    return res;
  }

  private renderPullDown() {
    const { pullDownContent } = this.props;
    const { isBeforePullDown, isPullingDown } = this.state;
    return (
      <div className="downWrapper">
        <div className="downBeforeTrigger" style={{ display: isBeforePullDown ? 'block' : 'none' }}>
          {pullDownContent}
        </div>
        <div className="downLoading" style={{ display: !isBeforePullDown && isPullingDown ? 'block' : 'none' }}>
          <Loading />
        </div>
      </div>
    );
  }

  private pullUpRetry() {

  }

  private renderPullUp() {
    const { customNoData, errorContent, finishUpContent, showLoading } = this.props;
    const { isPullUpError, isBeforePullDown, isPullingDown, isFinishUp, isPullingUp } = this.state;

    // loading第一次不加载，下拉情况下需要隐藏上拉元素
    if ((this.firstIntoPage && !showLoading) || customNoData) return null;
    return (
      <div className="upWrapper" style={{ display: isBeforePullDown || isPullingDown ? 'none' : 'flex' }}>
        <div
          className="upAfterTrigger"
          style={{ display: isFinishUp ? 'block' : 'none' }}
        >
          {finishUpContent}
        </div>
        <div
          className="upLoading"
          style={{ display: isPullingUp ? 'block' : 'none' }}
        >
          <Loading />
        </div>
        <div
          className="upBeforeTrigger"
          onClick={this.pullUpRetry}
          style={{ display: isPullUpError && !isFinishUp && !isPullingUp ? 'block' : 'none' }}
        >
          {errorContent}
        </div>
      </div>
    );
  }

  render() {
    const { pullUp, pullDown, children } = this.props;
    return (
      <div className="scroll" ref={this.scrollRef}>
        <div className="scrollList">
          {pullDown && this.renderPullDown()}
          {children}
          {pullUp && this.renderPullUp()}
        </div>
      </div>
    );
  }
}

export default ScrollView;