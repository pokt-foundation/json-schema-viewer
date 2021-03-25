import 'jest-enzyme';

import { mount, ReactWrapper } from 'enzyme';
import * as fastGlob from 'fast-glob';
import * as fs from 'fs';
import { JSONSchema4 } from 'json-schema';
import * as path from 'path';
import * as React from 'react';

import { JsonSchemaViewer } from '../components';
import { ViewMode } from '../types';
import { dumpDom } from './utils/dumpDom';

describe('HTML Output', () => {
  it.each(
    fastGlob.sync('**/*.json', {
      cwd: path.join(__dirname, '../__fixtures__'),
      ignore: ['stress-schema.json'],
    }),
  )('should match %s', filename => {
    const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../__fixtures__/', filename), 'utf8'));

    expect(dumpDom(<JsonSchemaViewer schema={schema} defaultExpandedDepth={Infinity} />)).toMatchSnapshot();
  });

  describe.each(['anyOf', 'oneOf'])('given %s combiner placed next to allOf', combiner => {
    let schema: JSONSchema4;

    beforeEach(() => {
      schema = {
        type: 'object',
        title: 'Account',
        allOf: [
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['admin', 'editor'],
              },
              enabled: {
                type: 'boolean',
                description: 'Is this account enabled',
              },
            },
            required: ['type'],
          },
        ],
        [combiner]: [
          {
            type: 'object',
            title: 'Admin',
            properties: {
              root: {
                type: 'boolean',
              },
              group: {
                type: 'string',
              },
              expirationDate: {
                type: 'string',
              },
            },
          },
          {
            type: 'object',
            title: 'Editor',
            properties: {
              supervisor: {
                type: 'string',
              },
              key: {
                type: 'string',
              },
            },
          },
        ],
      };
    });

    it('given allOf merging enabled, should merge contents of allOf combiners', () => {
      expect(dumpDom(<JsonSchemaViewer schema={schema} defaultExpandedDepth={Infinity} />)).toMatchSnapshot();
    });
  });

  it('given array with oneOf containing items, should merge it correctly', () => {
    const schema: JSONSchema4 = {
      oneOf: [
        {
          items: {
            type: 'string',
          },
        },
        {
          items: {
            type: 'number',
          },
        },
      ],
      type: 'array',
    };

    expect(dumpDom(<JsonSchemaViewer schema={schema} defaultExpandedDepth={Infinity} />)).toMatchSnapshot();
  });

  it.each<ViewMode>(['standalone', 'read', 'write'])('given %s mode, should populate proper nodes', mode => {
    const schema: JSONSchema4 = {
      type: ['string', 'object'],
      properties: {
        id: {
          type: 'string',
          readOnly: true,
        },
        description: {
          type: 'string',
          writeOnly: true,
        },
      },
    };

    expect(
      dumpDom(<JsonSchemaViewer schema={schema} defaultExpandedDepth={Infinity} viewMode={mode} />),
    ).toMatchSnapshot();
  });

  it('given multiple object and string type, should process properties', () => {
    const schema: JSONSchema4 = {
      type: ['string', 'object'],
      properties: {
        ids: {
          type: 'array',
          items: {
            type: 'integer',
          },
        },
      },
    };

    expect(dumpDom(<JsonSchemaViewer schema={schema} defaultExpandedDepth={Infinity} />)).toMatchSnapshot();
  });

  it('given complex type that includes array and complex array subtype, should not ignore subtype', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        items: {
          type: ['null', 'array'],
          items: {
            type: ['string', 'number'],
          },
          description:
            "This description can be long and should truncate once it reaches the end of the row. If it's not truncating then theres and issue that needs to be fixed. Help!",
        },
      },
    };

    expect(dumpDom(<JsonSchemaViewer schema={schema} defaultExpandedDepth={Infinity} />)).toMatchSnapshot();
  });

  it('given visible $ref node, should try to inject the title immediately', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        foo: {
          $ref: '#/properties/user',
        },
        user: {
          title: 'User',
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
        },
      },
    };

    expect(dumpDom(<JsonSchemaViewer schema={schema} />)).toMatchSnapshot();
  });
});

describe.each([{}, { unknown: '' }, { $ref: null }])('given empty schema, should render empty text', schema => {
  const wrapper = mount(<JsonSchemaViewer schema={schema as any} />);
  expect(wrapper).toHaveText('No schema defined');
  wrapper.unmount();
});

describe('Expanded depth', () => {
  const toUnmount: ReactWrapper[] = [];

  function mountWithAutoUnmount(node: React.ReactElement) {
    const wrapper = mount(node);
    toUnmount.push(wrapper);
    return wrapper;
  }

  afterEach(() => {
    while (toUnmount.length > 0) {
      toUnmount.pop()?.unmount();
    }
  });

  describe('merged array with object', () => {
    let schema: JSONSchema4;

    beforeEach(() => {
      schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            foo: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bar: {
                    type: 'object',
                    properties: {
                      baz: {
                        type: 'integer',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
    });

    describe('static', () => {
      it('given initial level set to -1, should render only top-level property', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={-1} />);

        expect(dumpDom(wrapper.getElement())).toMatchInlineSnapshot(`
          "<div class=\\"\\">
            <div class=\\"JsonSchemaViewer\\">
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div style=\\"width: 20px; height: 20px; position: relative\\" role=\\"button\\"></div>
                        <div><span>array of objects</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
            </div>
          </div>
          "
        `);
      });

      it('given initial level set to 0, should render top 2 levels', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={0} />);

        expect(dumpDom(wrapper.getElement())).toMatchInlineSnapshot(`
          "<div class=\\"\\">
            <div class=\\"JsonSchemaViewer\\">
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div style=\\"width: 20px; height: 20px; position: relative\\" role=\\"button\\"></div>
                        <div><span>array of objects</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
                <div>
                  <div style=\\"margin-left: 20px\\">
                    <div>
                      <div>
                        <div>
                          <div>
                            <div style=\\"width: 20px; height: 20px; left: -23.5px\\" role=\\"button\\"></div>
                            <div>
                              <div>foo</div>
                              <span>array of objects</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          "
        `);
      });

      it('given initial level set to 1, should render top 3 levels', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={1} />);

        expect(dumpDom(wrapper.getElement())).toMatchInlineSnapshot(`
          "<div class=\\"\\">
            <div class=\\"JsonSchemaViewer\\">
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div style=\\"width: 20px; height: 20px; position: relative\\" role=\\"button\\"></div>
                        <div><span>array of objects</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
                <div>
                  <div style=\\"margin-left: 20px\\">
                    <div>
                      <div>
                        <div>
                          <div>
                            <div style=\\"width: 20px; height: 20px; left: -23.5px\\" role=\\"button\\"></div>
                            <div>
                              <div>foo</div>
                              <span>array of objects</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div></div>
                    </div>
                    <div>
                      <div style=\\"margin-left: 20px\\">
                        <div>
                          <div>
                            <div>
                              <div>
                                <div style=\\"width: 20px; height: 20px; left: -23.5px\\" role=\\"button\\"></div>
                                <div>
                                  <div>bar</div>
                                  <span>object</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          "
        `);
      });
    });
  });

  describe('merged array with object #2', () => {
    let schema: JSONSchema4;

    beforeEach(() => {
      schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bar: {
              type: 'integer',
            },
            foo: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bar: {
                    type: 'string',
                  },
                  foo: {
                    type: 'number',
                  },
                },
              },
            },
          },
        },
      };
    });

    describe('static', () => {
      it('given initial level set to -1, should render only top-level property', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={-1} />);

        expect(dumpDom(wrapper.getElement())).toMatchInlineSnapshot(`
          "<div class=\\"\\">
            <div class=\\"JsonSchemaViewer\\">
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div style=\\"width: 20px; height: 20px; position: relative\\" role=\\"button\\"></div>
                        <div><span>array of objects</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
            </div>
          </div>
          "
        `);
      });

      it('given initial level set to 0, should render top 2 levels', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={0} />);

        expect(dumpDom(wrapper.getElement())).toMatchInlineSnapshot(`
          "<div class=\\"\\">
            <div class=\\"JsonSchemaViewer\\">
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div style=\\"width: 20px; height: 20px; position: relative\\" role=\\"button\\"></div>
                        <div><span>array of objects</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
                <div>
                  <div style=\\"margin-left: 20px\\">
                    <div>
                      <div>
                        <div>
                          <div>
                            <div>
                              <div>bar</div>
                              <span>integer</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div></div>
                    </div>
                  </div>
                  <div></div>
                  <div style=\\"margin-left: 20px\\">
                    <div>
                      <div>
                        <div>
                          <div>
                            <div style=\\"width: 20px; height: 20px; left: -23.5px\\" role=\\"button\\"></div>
                            <div>
                              <div>foo</div>
                              <span>array of objects</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          "
        `);
      });

      it('given initial level set to 1, should render top 3 levels', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={1} />);

        expect(dumpDom(wrapper.getElement())).toMatchInlineSnapshot(`
          "<div class=\\"\\">
            <div class=\\"JsonSchemaViewer\\">
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div style=\\"width: 20px; height: 20px; position: relative\\" role=\\"button\\"></div>
                        <div><span>array of objects</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
                <div>
                  <div style=\\"margin-left: 20px\\">
                    <div>
                      <div>
                        <div>
                          <div>
                            <div>
                              <div>bar</div>
                              <span>integer</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div></div>
                    </div>
                  </div>
                  <div></div>
                  <div style=\\"margin-left: 20px\\">
                    <div>
                      <div>
                        <div>
                          <div>
                            <div style=\\"width: 20px; height: 20px; left: -23.5px\\" role=\\"button\\"></div>
                            <div>
                              <div>foo</div>
                              <span>array of objects</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div></div>
                    </div>
                    <div>
                      <div style=\\"margin-left: 20px\\">
                        <div>
                          <div>
                            <div>
                              <div>
                                <div>
                                  <div>bar</div>
                                  <span>string</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div></div>
                        </div>
                      </div>
                      <div></div>
                      <div style=\\"margin-left: 20px\\">
                        <div>
                          <div>
                            <div>
                              <div>
                                <div>
                                  <div>foo</div>
                                  <span>number</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          "
        `);
      });
    });
  });

  describe('nested object', () => {
    let schema: JSONSchema4;

    beforeEach(() => {
      schema = {
        type: 'object',
        properties: {
          bar: {
            type: 'object',
            properties: {
              barFoo: {
                type: 'object',
                properties: {
                  barFooBar: {
                    type: 'object',
                  },
                },
              },
              barBar: {
                type: 'string',
              },
              barBaz: {
                type: 'boolean',
              },
            },
          },
          foo: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fooBar: {
                  type: 'string',
                },
                fooFoo: {
                  type: 'number',
                },
              },
            },
          },
        },
      };
    });

    describe('static', () => {
      it('given initial level set to -1, should render only top-level property', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={-1} />);

        expect(dumpDom(wrapper.getElement())).toMatchInlineSnapshot(`
          "<div class=\\"\\">
            <div class=\\"JsonSchemaViewer\\">
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div style=\\"width: 20px; height: 20px; position: relative\\" role=\\"button\\"></div>
                        <div><span>object</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
            </div>
          </div>
          "
        `);
      });

      it('given initial level set to 0, should render top 2 levels', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={0} />);

        expect(dumpDom(wrapper.getElement())).toMatchSnapshot();
      });

      it('given initial level set to 1, should render top 3 levels', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={1} />);

        expect(dumpDom(wrapper.getElement())).toMatchSnapshot();
      });

      it('given initial level set to 2, should render top 4 levels', () => {
        const wrapper = mountWithAutoUnmount(<JsonSchemaViewer schema={schema} defaultExpandedDepth={2} />);

        expect(dumpDom(wrapper.getElement())).toMatchSnapshot();
      });
    });
  });
});

describe('$ref resolving', () => {
  it('should render caret for schema with top-level $ref pointing at complex type', () => {
    const schema: JSONSchema4 = {
      $ref: '#/definitions/foo',
      definitions: {
        foo: {
          type: 'string',
        },
      },
    };

    expect(dumpDom(<JsonSchemaViewer schema={schema} />)).toMatchInlineSnapshot(`
      "<div class=\\"\\">
        <div class=\\"JsonSchemaViewer\\">
          <div style=\\"margin-left: 20px\\">
            <div>
              <div>
                <div>
                  <div>
                    <div><span>string</span></div>
                  </div>
                </div>
              </div>
              <div></div>
            </div>
          </div>
        </div>
      </div>
      "
    `);
  });

  it('should render caret for top-level array with $ref items', () => {
    const schema: JSONSchema4 = {
      type: 'array',
      items: {
        $ref: '#/foo',
      },
    };

    expect(dumpDom(<JsonSchemaViewer schema={schema} />)).toMatchInlineSnapshot(`
      "<div class=\\"\\">
        <div class=\\"JsonSchemaViewer\\">
          <div style=\\"margin-left: 20px\\">
            <div>
              <div>
                <div>
                  <div>
                    <div style=\\"width: 20px; height: 20px; left: -23.5px\\" role=\\"button\\"></div>
                    <div><span>$ref(#/foo)[]</span></div>
                  </div>
                </div>
              </div>
              <div></div>
            </div>
            <div>
              <div style=\\"margin-left: 20px\\">
                <div>
                  <div>
                    <div>
                      <div>
                        <div><span>#/foo</span></div>
                      </div>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      "
    `);
  });
});
