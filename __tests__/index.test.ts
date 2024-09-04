import * as main from '../src/main';

jest.mock('../src/main', () => ({
  run: jest.fn()
}));

const runMock = jest.spyOn(main, 'run').mockImplementation();

describe('index', () => {
  it('calls run when imported', async () => {
    require('../src/index');

    expect(runMock).toHaveBeenCalled();
  });
});
