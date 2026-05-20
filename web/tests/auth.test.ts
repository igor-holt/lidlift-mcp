import { describe, expect, it } from "vitest";

import { getOperatorIdentity, requireOperator } from "../netlify/functions/lib/auth";

describe("operator auth helpers", () => {
  it("extracts operator roles from client context", () => {
    const identity = getOperatorIdentity({
      clientContext: {
        user: {
          email: "operator@example.com",
          app_metadata: {
            roles: ["operator", "observer"],
          },
        },
      },
    } as never);

    expect(identity).toEqual({
      email: "operator@example.com",
      roles: ["operator", "observer"],
    });
  });

  it("rejects requests without an operator role", () => {
    expect(() =>
      requireOperator({
        clientContext: {
          user: {
            email: "observer@example.com",
            app_metadata: {
              roles: ["observer"],
            },
          },
        },
      } as never),
    ).toThrow(Response);
  });
});
