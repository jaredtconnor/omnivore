import { ContentHandler } from '../content-handler'

export class WeixinQqHandler extends ContentHandler {
  constructor() {
    super()
    this.name = 'Weixin QQ'
  }

  shouldPreParse(url: string, dom: Document): boolean {
    return new URL(url).hostname.endsWith('weixin.qq.com')
  }

  async preParse(url: string, dom: Document): Promise<Document> {
    // This replace the class name of the article info to preserve the block
    dom
      .querySelector('.rich_media_meta_list')
      ?.setAttribute('class', '_omnivore_rich_media_meta_list')

    // This removes the title
    dom.querySelector('.rich_media_title')?.remove()

    // This removes the profile info
    dom.querySelector('.profile_container')?.remove()

    //  This removes the footer
    dom.querySelector('#content_bottom_area')?.remove()
    dom.querySelector('.rich_media_area_extra')?.remove()
    dom.querySelector('#js_pc_qr_code')?.remove()

    return Promise.resolve(dom)
  }
}
