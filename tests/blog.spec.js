const { test, expect, describe, beforeEach } = require('@playwright/test');

const actionLogout = async (page) => {
  await page.getByRole('button', { name: 'Logout' }).click();
}

const actionLogin = async (page, user, pass) => {
  await page.locator('input[name="Username"]').fill(user)
  await page.locator('input[name="Password"]').fill(pass)
  await page.locator('button').click()
}

const getBlogHeader = (blogName, blogAuthor) => {
  return `${blogName} - ${blogAuthor}`
}

const actionAddBlog = async (page, blogName, blogAuthor, blogUrl) => {
  await page.getByRole('button', { name: 'Add blog' }).click();
  await page.locator('input[name="BlogTitle"]').fill(blogName);
  await page.locator('input[name="BlogAuthor"]').fill(blogAuthor);
  await page.locator('input[name="BlogUrl"]').fill(blogUrl);
  await page.getByRole('button', { name: 'submit' }).click();

  await page.getByText(getBlogHeader(blogName, blogAuthor)).waitFor()
}

describe("Blog app", () => {
  beforeEach(async ( {page, request} ) => {
    await request.post('/api/testing/reset')
    await request.post('/api/users', {
      data: {
        user: 'root',
        name: 'Rooty',
        password: 'root'
      }
    })

    await request.post('/api/users', {
      data: {
        user: 'second',
        name: 'Rooty',
        password: 'second'
      }
    })

    await page.goto('/')
  })


  test('login form is shown', async ({ page }) => {  
    const usernameField = page.locator('input[name="Username"]')
    expect(usernameField).toBeDefined()
    await expect(usernameField).toBeVisible()
  });

  describe('test login', () => {
    test('can login', async ({page}) => {
      await actionLogin(page, 'root', 'root')
  
      await expect(page.getByText('Rooty logged in')).toBeVisible()
      await expect(page.locator('input[name="Username"]')).not.toBeVisible()
    })
  
    test('cant login with wrong credentials', async ({page}) => {
      await actionLogin(page, 'root', 'wrongpass')
  
      await expect(page.getByText('Rooty logged in')).not.toBeVisible()
      await expect(page.locator('input[name="Username"]')).toBeVisible()
    })
  })  

  describe("user is logged in", () => {
    beforeEach(async ( {page} ) => {
        await actionLogin(page, 'root', 'root')
    })

    test('can logout', async ({page}) => {
      await actionLogout(page)
      
      await expect(page.getByText('Rooty logged in')).not.toBeVisible()
      await expect(page.locator('input[name="Username"]')).toBeVisible()
    })

    test('blogs dont exist', async ({page}) => {
      await expect(page.locator('.blog')).toHaveCount(0)
    })

    test('new blog can be created', async ({page}) => {
      const blogName = 'Blog by title'
      const blogAuthor = 'AuthorName'

      await actionAddBlog(page, blogName, blogAuthor, 'localhost')

      const newBlog = page.locator('.blog').first()
      await newBlog.waitFor()

      expect(newBlog).toBeDefined()
      await expect(page.getByText(getBlogHeader(blogName, blogAuthor))).toBeVisible()
    })

    describe('blog exists', () => {
      beforeEach(async ( {page} ) => {
        const blogName = 'BlogToBeEdited'
        const blogAuthor = 'AuthorName'
        await actionAddBlog(page, blogName, blogAuthor, 'localhost')
      })

      test('blog can be edited', async ({page}) => {
        const newBlog = page.getByText(getBlogHeader('BlogToBeEdited', 'AuthorName'))
        const newBlogParent = newBlog.locator('..')
  
        await newBlog.getByRole('button', { name: 'show' }).click();
        await newBlogParent.getByRole('button', { name: 'like' }).click();
        
        await expect(newBlogParent.getByText('likes: 1')).toBeVisible()
      })

      test('blog can be deleted', async ({page}) => {
        const newBlog = page.getByText(getBlogHeader('BlogToBeEdited', 'AuthorName'))
        const newBlogParent = newBlog.locator('..')
  
        page.on('dialog', dialog => dialog.accept());

        await newBlog.getByRole('button', { name: 'show' }).click();
        await newBlogParent.getByRole('button', { name: 'delete' }).click();
        
        await expect(newBlog).toHaveCount(0)
      })

      test('cant see delete after logging as another user', async ({page}) => {
        await actionLogout(page)
        await actionLogin(page, 'second', 'second')

        const newBlog = page.getByText(getBlogHeader('BlogToBeEdited', 'AuthorName'))
        const newBlogParent = newBlog.locator('..')
        
        await newBlog.getByRole('button', { name: 'show' }).click();

        await expect(newBlogParent.getByRole('button', { name: 'like' })).toBeVisible()
        await expect(newBlogParent.getByRole('button', { name: 'delete' })).toHaveCount(0)
      })


      test('blogs are sorted by likes', async ({page}) => {
        const firstBlog = page.locator('.blog').first()
        await firstBlog.getByRole('button', { name: 'show' }).click();
      
        // Like first blog
        await firstBlog.getByRole('button', { name: 'like' }).click();
        await expect(firstBlog.getByText('likes: 1')).toBeVisible()

        // Add second blog
        await actionAddBlog(page, 'secondBlog', 'secondAuthor', 'url.net')
        const secondBlog = page.locator('.blog').last()
        await secondBlog.getByRole('button', { name: 'show' }).click();
        await expect(secondBlog.getByText('likes: 0')).toBeVisible()

        // Like second blog multiple times
        await secondBlog.getByRole('button', { name: 'like' }).click();
        await expect(secondBlog.getByText('likes: 1')).toBeVisible()
        
        await secondBlog.getByRole('button', { name: 'like' }).click();
        await expect(secondBlog.getByText('likes: 2')).toBeVisible()

        await secondBlog.getByRole('button', { name: 'like' }).click();
        await expect(secondBlog.getByText('likes: 3')).toBeVisible()

        // Refresh page to see new order
        await page.reload()

        const newFirst = page.locator('.blog').first()
        await newFirst.getByRole('button', { name: 'show' }).click();

        // The blog with higher likes is first
        await expect(newFirst.getByText('likes: 3')).toBeVisible()
      })
    })
  })
})
