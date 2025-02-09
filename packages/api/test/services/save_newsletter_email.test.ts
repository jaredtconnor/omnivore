import { expect } from 'chai'
import 'chai/register-should'
import 'mocha'
import nock from 'nock'
import { createPubSubClient } from '../../src/datalayer/pubsub'
import { getPageByParam } from '../../src/elastic/pages'
import { NewsletterEmail } from '../../src/entity/newsletter_email'
import { ReceivedEmail } from '../../src/entity/received_email'
import { Subscription } from '../../src/entity/subscription'
import { User } from '../../src/entity/user'
import { getRepository } from '../../src/entity/utils'
import { createNewsletterEmail } from '../../src/services/newsletters'
import { SaveContext } from '../../src/services/save_email'
import { saveNewsletterEmail } from '../../src/services/save_newsletter_email'
import { createTestUser, deleteTestUser } from '../db'

describe('saveNewsletterEmail', () => {
  const fakeContent = 'fake content'
  const title = 'fake title'
  const author = 'fake author'
  const from = 'fake from'
  const text = 'fake text'

  let user: User
  let newsletterEmail: NewsletterEmail
  let ctx: SaveContext
  let receivedEmail: ReceivedEmail

  before(async () => {
    user = await createTestUser('fakeUser')
    newsletterEmail = await createNewsletterEmail(user.id)
    ctx = {
      pubsub: createPubSubClient(),
      refresh: true,
      uid: user.id,
    }
    receivedEmail = await getRepository(ReceivedEmail).save({
      user: { id: user.id },
      from,
      to: newsletterEmail.address,
      subject: title,
      text,
      html: '',
      type: 'non-article',
    })
  })

  after(async () => {
    await deleteTestUser(user.id)
  })

  it('adds the newsletter to the library', async () => {
    nock('https://blog.omnivore.app').get('/fake-url').reply(200)
    nock('https://blog.omnivore.app').head('/fake-url').reply(200)
    const url = 'https://blog.omnivore.app/fake-url'

    await saveNewsletterEmail(
      {
        from,
        email: newsletterEmail.address,
        content: `<html><body>${fakeContent}</body></html>`,
        url,
        title,
        author,
        receivedEmailId: receivedEmail.id,
        unsubHttpUrl: 'https://blog.omnivore.app/unsubscribe',
      },
      newsletterEmail,
      ctx
    )

    const page = await getPageByParam({ userId: user.id, url })
    expect(page).to.exist
    expect(page?.url).to.equal(url)
    expect(page?.title).to.equal(title)
    expect(page?.author).to.equal(author)
    expect(page?.content).to.contain(fakeContent)

    const subscriptions = await getRepository(Subscription).findBy({
      newsletterEmail: { id: newsletterEmail.id },
    })
    expect(subscriptions).not.to.be.empty
  })

  it('adds a Newsletter label to that page', async () => {
    nock('https://blog.omnivore.app').get('/new-fake-url').reply(200)
    nock('https://blog.omnivore.app').head('/new-fake-url').reply(200)
    const url = 'https://blog.omnivore.app/new-fake-url'
    const newLabel = {
      name: 'Newsletter',
      color: '#07D2D1',
    }

    await saveNewsletterEmail(
      {
        email: newsletterEmail.address,
        content: `<html><body>fake content 2</body></html>`,
        url,
        title,
        author,
        from,
        receivedEmailId: receivedEmail.id,
      },
      newsletterEmail,
      ctx
    )

    const page = await getPageByParam({ userId: user.id, url })
    expect(page?.labels?.[0]).to.deep.include(newLabel)
  })

  it('does not create a subscription if no unsubscribe header', async () => {
    const url = 'https://blog.omnivore.app/no-unsubscribe'
    nock('https://blog.omnivore.app').get('/no-unsubscribe').reply(404)

    await saveNewsletterEmail(
      {
        email: newsletterEmail.address,
        content: `<html><body>fake content 2</body></html>`,
        url,
        title,
        author,
        from,
        receivedEmailId: receivedEmail.id,
      },
      newsletterEmail,
      ctx
    )

    const subscriptions = await getRepository(Subscription).findBy({
      newsletterEmail: { id: newsletterEmail.id },
      name: from,
    })
    expect(subscriptions).to.be.empty
  })
})
