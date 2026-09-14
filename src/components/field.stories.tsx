import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/field";
import { Input } from "@/components/input";

const meta = {
  title: "Design System/Field",
  component: Field,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal", "responsive"],
    },
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: (args) => (
    <FieldSet className="w-full max-w-xs">
      <FieldLegend>Account</FieldLegend>
      <FieldGroup>
        <Field {...args}>
          <FieldTitle>Username</FieldTitle>
          <FieldDescription>This is how people know you.</FieldDescription>
          <FieldContent>
            <Input placeholder="alex" />
          </FieldContent>
          <FieldError errors={[{ message: "That username is already taken." }]} />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};

export const Horizontal: Story = {
  render: (args) => (
    <FieldSet className="w-full max-w-lg">
      <FieldGroup>
        <Field {...args} orientation="horizontal">
          <FieldTitle>Notifications</FieldTitle>
          <FieldDescription>Get a ping when someone replies.</FieldDescription>
          <FieldContent>
            <Input placeholder="email@example.com" />
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};

export const MultipleErrors: Story = {
  render: (args) => (
    <FieldSet className="w-full max-w-xs">
      <FieldGroup>
        <Field {...args}>
          <FieldTitle>Password</FieldTitle>
          <FieldContent>
            <Input type="password" placeholder="••••••••" />
          </FieldContent>
          <FieldError
            errors={[
              { message: "Must be at least 8 characters." },
              { message: "Must contain a number." },
            ]}
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};

export const LegendAsLabel: Story = {
  render: (args) => (
    <FieldSet className="w-full max-w-xs">
      <Field {...args}>
        <FieldLegend variant="label">Bio</FieldLegend>
        <FieldContent>
          <Input placeholder="Short bio about yourself" />
        </FieldContent>
      </Field>
    </FieldSet>
  ),
};