import React from 'react';
import ReactDOM from 'react-dom/client';
import ThankYouEditor from './ThankYouEditor';

class OrderEditorPluginElement extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private _orderId: string = 'wix-order-1001';
  private _siteId: string = 'default-site';
  private _isEditorPreview: boolean = false;

  static get observedAttributes() {
    return ['order-id', 'site-id', 'is-editor-preview'];
  }

  set orderId(val: string) {
    this._orderId = val;
    this.render();
  }

  get orderId() {
    return this._orderId;
  }

  set siteId(val: string) {
    this._siteId = val;
    this.render();
  }

  get siteId() {
    return this._siteId;
  }

  set isEditorPreview(val: boolean) {
    this._isEditorPreview = Boolean(val);
    this.render();
  }

  get isEditorPreview() {
    return this._isEditorPreview;
  }

  connectedCallback() {
    // Check if in Wix Editor canvas
    const urlParams = new URLSearchParams(window.location.search);
    const orderFromQuery = urlParams.get('orderId') || urlParams.get('order_id');
    if (orderFromQuery) {
      this._orderId = orderFromQuery;
    }

    if (window.location.hostname.includes('editor.wix.com')) {
      this._isEditorPreview = true;
    }

    this.render();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'order-id') this._orderId = newValue;
    if (name === 'site-id') this._siteId = newValue;
    if (name === 'is-editor-preview') this._isEditorPreview = newValue === 'true';
    this.render();
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  render() {
    if (!this.root) {
      this.root = ReactDOM.createRoot(this);
    }

    this.root.render(
      <ThankYouEditor
        orderId={this._orderId}
        siteId={this._siteId}
        isEditorPreview={this._isEditorPreview}
      />
    );
  }
}

if (!customElements.get('order-editor-plugin')) {
  customElements.define('order-editor-plugin', OrderEditorPluginElement);
}

export default OrderEditorPluginElement;
